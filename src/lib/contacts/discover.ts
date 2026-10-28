import "server-only";
import { z } from "zod";
import { db, newId, nowIso } from "@/lib/db";
import { env } from "@/lib/env";
import { generateStructured } from "@/lib/ai/openai";
import { webSearch, type SearchResult } from "@/lib/search";
import { setJobStage } from "@/lib/jobs";
import { asUntrustedBlock, hostOf, normaliseForMatch, safeUrl } from "@/lib/security/content";
import { recordUsage } from "@/lib/security/rate-limit";
import { demoContactResults, demoExtraction } from "@/lib/fixtures/contacts";
import { contactKey, decideStatus, nameAppears, refSupports, verifiedEmail, verifiedPhone, type CandidateRef, type RetrievedText } from "./verify";
import type { Contact, ContactSource, Destination, ResearchJob } from "@/lib/types";

const Extraction = z.object({
  organisation: z.string().max(200),
  official_website_source: z.string().nullable(),
  india_office: z.string().max(300).nullable(),
  representation_agency: z.string().max(300).nullable(),
  notes: z.array(z.string().max(400)).max(8),
  candidates: z
    .array(
      z.object({
        full_name: z.string().min(3).max(120),
        job_title: z.string().min(2).max(200),
        organisation: z.string().max(200),
        destination: z.string().max(120),
        responsibility: z.string().max(400),
        india_relevance: z.string().max(400),
        india_office: z.string().max(200).nullable(),
        agency: z.string().max(200).nullable(),
        email: z.string().max(200).nullable(),
        phone: z.string().max(60).nullable(),
        refs: z.array(z.object({ source: z.string(), quote: z.string().max(600) })).min(1).max(6),
      }),
    )
    .max(12),
});

export interface Target {
  destination: string;
  board: string;
  officialHosts: string[];
  dest: Destination | null;
}

/** Step 1-2: identify the official tourism organisation and its website from the destination directory. */
export async function resolveTarget(query: string, destinationHint?: string | null): Promise<Target> {
  const all = await db().list("destinations", { limit: 500 });
  const q = normaliseForMatch(`${destinationHint ?? ""} ${query}`);
  const dest =
    all.find((d) => destinationHint && d.name.toLowerCase() === destinationHint.toLowerCase()) ??
    all.find((d) => ` ${q} `.includes(` ${normaliseForMatch(d.name)} `)) ??
    all.find((d) => d.tourism_board && q.includes(normaliseForMatch(d.tourism_board).split(" ").slice(0, 2).join(" "))) ??
    null;
  const destination = dest?.name ?? destinationHint ?? query.replace(/\b(tourism|board|india|office|representative|representation|delhi|mumbai|contacts?)\b/gi, "").trim() ?? query;
  const board = dest?.tourism_board ?? `${destination} tourism board`;
  const officialHosts = [dest?.board_website, dest?.india_page].filter(Boolean).map((u) => hostOf(u!)).filter(Boolean);
  if (env.demoFixtures) officialHosts.push("gov.demo-fixture.invalid");
  return { destination: destination || query, board, officialHosts, dest };
}

function toRetrieved(r: SearchResult): RetrievedText {
  return { url: r.url, title: r.title, publisher: r.publisher, text: r.content || r.snippet, published_at: r.published_at };
}

/** Steps 3-6: search official site, India office, team listings, announcements and representation agencies. */
async function gatherSources(query: string, t: Target, userId: string, notes: string[]) {
  const searches: { q: string; opts: Parameters<typeof webSearch>[1] }[] = [
    { q: `${t.board} India office director`, opts: { userId, deep: true, maxResults: 5 } },
    { q: `${t.board} India representative appointed`, opts: { userId, deep: true, maxResults: 5 } },
    { q: `${t.destination} tourism India representation agency`, opts: { userId, deep: true, maxResults: 5 } },
    { q: `${t.board} marketing partnerships manager India`, opts: { userId, deep: true, maxResults: 5 } },
  ];
  if (t.officialHosts[0] && !env.demoFixtures) searches.push({ q: `${t.board} team contact India`, opts: { userId, deep: true, maxResults: 5, includeDomains: [t.officialHosts[0]] } });
  if (!searches.some((s) => s.q.toLowerCase() === query.toLowerCase())) searches.push({ q: query, opts: { userId, deep: true, maxResults: 5 } });

  const settled = await Promise.allSettled(searches.map((s) => webSearch(s.q, s.opts)));
  const results: SearchResult[] = [];
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") results.push(...s.value);
    else notes.push(`Search "${searches[i].q}" failed: ${(s.reason as Error).message}`);
  });
  if (settled.every((s) => s.status === "rejected")) throw (settled[0] as PromiseRejectedResult).reason;
  if (env.demoFixtures) results.push(...demoContactResults(t.board, t.destination));

  // LinkedIn results are used only to attach a profile URL to an already-verified person.
  let linkedin: SearchResult[] = [];
  if (!env.demoFixtures) {
    try {
      linkedin = await webSearch(`${t.board} India`, { userId, maxResults: 8, includeDomains: ["linkedin.com"] });
    } catch {
      notes.push("LinkedIn profile lookup was unavailable.");
    }
  }

  const seen = new Set<string>();
  const unique = results.filter((r) => {
    const k = r.url.replace(/[?#].*$/, "");
    if (seen.has(k) || /linkedin\.com/.test(hostOf(r.url))) return false;
    seen.add(k);
    return true;
  });
  return { sources: unique.slice(0, 24), linkedin };
}

/** Background job: genuine contact discovery with deterministic verification. */
export async function runContactJob(job: ResearchJob): Promise<void> {
  const input = job.input as { query: string; search_id: string; destination?: string | null };
  const store = db();
  const notes: string[] = [];
  try {
    const target = await resolveTarget(input.query, input.destination);
    notes.push(target.dest ? `Official organisation identified from the destination directory: ${target.board}${target.dest.board_website ? ` (${target.dest.board_website})` : ""}.` : `No directory entry matched; searched for "${target.board}".`);
    if (target.dest && !target.dest.board_verified) notes.push("The board's official website in the directory has not itself been verified yet.");

    await setJobStage(job.id, "finding_sources", `Searching official site, India office, announcements and agencies for ${target.board}`);
    const { sources, linkedin } = await gatherSources(input.query, target, job.created_by, notes);
    if (!sources.length) {
      notes.push("Not Found: no sources were returned for this search.");
      await finish(job, input.search_id, target, [], notes);
      return;
    }

    await setJobStage(job.id, "extracting_facts", `Reading ${sources.length} sources for named professional contacts`);
    const labelled = new Map<string, RetrievedText>();
    sources.forEach((s, i) => labelled.set(`S${i + 1}`, toRetrieved(s)));
    const blocks = [...labelled.entries()]
      .map(([k, s]) => asUntrustedBlock(k, `URL: ${s.url}\nTitle: ${s.title}\nPublished: ${s.published_at ?? "unknown"}\n${s.text.slice(0, 5000)}`))
      .join("\n\n");

    const extracted = await generateStructured({
      task: "contacts.extract",
      schema: Extraction,
      userId: job.created_by,
      system: [
        "You extract publicly listed PROFESSIONAL contacts for a tourism organisation and its India-market representation, for business partnership outreach.",
        "Only include people who hold a role at the tourism board, its India office, or its appointed India representation agency, in marketing, partnerships, business development, PR, travel trade or India-market leadership.",
        "Every candidate needs at least one ref: the source label (e.g. S3) and a VERBATIM quote copied exactly from that source that contains the person's full name and job title.",
        "Never infer, guess or construct names, titles, email addresses or phone numbers. Only give an email or phone if it is printed verbatim in a source as a business contact. Never include personal information.",
        "Flag in notes anything ambiguous or possibly outdated (e.g. an old appointment announcement).",
      ].join("\n"),
      user: `Search request: ${input.query}\nDestination: ${target.destination}\nOrganisation: ${target.board}\n\nSources:\n${blocks}`,
      fixture: () => demoExtraction(labelled, target.board, target.destination),
      maxTokens: 8000,
    });
    notes.push(...extracted.notes);
    if (extracted.india_office) notes.push(`India office: ${extracted.india_office}`);
    if (extracted.representation_agency) notes.push(`India representation agency: ${extracted.representation_agency}`);

    await setJobStage(job.id, "verifying", `Cross-checking ${extracted.candidates.length} candidate(s) against source text`);
    const saved: Contact[] = [];
    let rejected = 0;
    const existing = await store.list("contacts", { limit: 2000 });

    for (const c of extracted.candidates) {
      const refs: CandidateRef[] = c.refs.map((r) => ({ source: labelled.get(r.source)!, quote: r.quote })).filter((r) => r.source);
      const supporting = refs.filter((r) => refSupports(r, c.full_name, c.job_title));
      const outcome = decideStatus(supporting, target.officialHosts);
      if (outcome.status === "Not Found") {
        rejected++;
        continue;
      }
      const texts = supporting.map((r) => r.source.text);
      const li = linkedin.find((r) => /linkedin\.com\/in\//.test(r.url) && nameAppears(c.full_name, r.title));
      const key = contactKey(c.full_name, c.organisation || target.board);
      const prior = existing.find((e) => contactKey(e.full_name, e.organisation) === key);
      const now = nowIso();
      const mergedSources: ContactSource[] = [...outcome.sources, ...(prior?.sources ?? []).filter((s) => !outcome.sources.some((n) => n.url === s.url))];
      const record: Contact = {
        id: prior?.id ?? newId("ct_"),
        full_name: c.full_name,
        job_title: c.job_title,
        organisation: c.organisation || target.board,
        destination: target.destination,
        responsibility: c.responsibility,
        india_relevance: c.india_relevance,
        india_office: c.india_office ?? prior?.india_office ?? null,
        agency: c.agency ?? prior?.agency ?? null,
        email: verifiedEmail(c.email, texts) ?? prior?.email ?? null,
        phone: verifiedPhone(c.phone, texts) ?? prior?.phone ?? null,
        website: target.dest?.board_website ?? prior?.website ?? null,
        linkedin: (li && safeUrl(li.url)) ?? prior?.linkedin ?? null,
        sources: mergedSources,
        status: outcome.status,
        verification_reason: outcome.reason,
        last_verified_at: now,
        notes: prior?.notes ?? "",
        query: input.query,
        created_by: prior?.created_by ?? job.created_by,
        created_at: prior?.created_at ?? now,
        updated_at: now,
        is_demo: env.demoFixtures,
      };
      await store.upsert("contacts", record);
      await store.insert("verification_events", {
        id: newId(),
        subject_type: "contact",
        subject_id: record.id,
        status: record.status,
        note: `${prior ? "Re-found" : "Found"} via search "${input.query}". ${record.verification_reason}`,
        actor: "contact finder",
        created_at: now,
      });
      saved.push(record);
    }
    if (rejected) notes.push(`${rejected} candidate(s) were discarded because their name and role could not be found in the cited source text.`);
    if (!saved.length) notes.push("Not Found: no reliable, verifiable contact was identified.");
    await finish(job, input.search_id, target, saved, notes);
  } catch (e) {
    await store.update("contact_searches", input.search_id, { status: "failed", error: e instanceof Error ? e.message : String(e), notes });
    throw e;
  }
}

async function finish(job: ResearchJob, searchId: string, t: Target, saved: Contact[], notes: string[]) {
  await db().update("contact_searches", searchId, { status: "completed", contact_ids: saved.map((c) => c.id), organisation: t.board, notes });
  await recordUsage(job.created_by, "contact_search", 1, { query: (job.input as { query: string }).query, found: saved.length });
  await setJobStage(job.id, "completed", `${saved.length} verifiable contact(s) found`, { result_id: searchId });
}

/** Re-verify one contact against fresh search results (no AI: the person's name and title must be in the text). */
export async function reverifyContact(contact: Contact, userId: string, actor: string): Promise<Contact> {
  const t = await resolveTarget(contact.organisation, contact.destination);
  const queries = [`"${contact.full_name}" ${contact.organisation}`, `"${contact.full_name}" ${contact.job_title}`];
  const results: SearchResult[] = [];
  for (const q of queries) {
    // Generic demo search fixtures echo the query text, so they could never count as evidence.
    results.push(...(await webSearch(q, { userId, deep: true, maxResults: 5 })).filter((r) => r.provider !== "demo"));
  }
  if (env.demoFixtures) results.push(...demoContactResults(contact.organisation, contact.destination));

  const supporting: CandidateRef[] = [];
  for (const r of results) {
    if (/linkedin\.com/.test(hostOf(r.url))) continue;
    const text = r.content || r.snippet;
    const sentence = text.split(/(?<=[.!?])\s+/).find((s) => nameAppears(contact.full_name, s));
    if (!sentence) continue;
    const ref = { source: toRetrieved(r), quote: sentence.slice(0, 400) };
    if (refSupports(ref, contact.full_name, contact.job_title)) supporting.push(ref);
  }
  const outcome = decideStatus(supporting, t.officialHosts);
  const now = nowIso();
  const status = outcome.status === "Not Found" ? "Needs Verification" : outcome.status;
  const reason =
    outcome.status === "Not Found"
      ? `Re-check on ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} found no current source naming this person in this role. Treat as possibly outdated.`
      : outcome.reason;
  const sources = [...outcome.sources, ...contact.sources.filter((s) => !outcome.sources.some((n) => n.url === s.url))];
  const updated = (await db().update("contacts", contact.id, { status, verification_reason: reason, sources, last_verified_at: now, updated_at: now }))!;
  await db().insert("verification_events", { id: newId(), subject_type: "contact", subject_id: contact.id, status, note: `Re-verified. ${reason}`, actor, created_at: now });
  await recordUsage(userId, "contact_search", 1, { reverify: contact.id });
  return updated;
}
