import "server-only";
import type { ZodType } from "zod";
import { db, nowIso, newId } from "@/lib/db";
import type { Claim, Destination, ImageRef, PlaceItem, Report, ReportContent, ReportOptions, ResearchJob, SourceRecord, SourcedText } from "@/lib/types";
import { NotConfiguredError } from "@/lib/env";
import { webSearch, type SearchResult } from "@/lib/search";
import { storeSources, verifyDraft, computeHealth, labelSources, type DraftClaim } from "@/lib/evidence";
import { generateStructured } from "@/lib/ai/openai";
import { asUntrustedBlock } from "@/lib/security/content";
import { findPhoto } from "@/lib/images";
import { getSettings } from "@/lib/settings";
import { setJobStage } from "@/lib/jobs";
import { fmtDate } from "@/lib/utils";
import { buildQueryPlan, GROUP_LABEL, type GroupKey } from "./queries";
import {
  CultureNatureFoodExtraction,
  FactsBoardExtraction,
  IndiaExtraction,
  PlacesExtraction,
  SnapshotExtraction,
  SynthesisSchema,
  type ClaimDraftInput,
  type CnfOut,
  type FactsBoardOut,
  type IndiaOut,
  type PlaceDraft,
  type PlacesOut,
  type SnapshotOut,
  type SynthesisOut,
} from "./schema";
import * as demo from "@/lib/fixtures/research";
import { summariseChanges } from "./versions";

export interface ResearchJobInput {
  report_id: string;
  version: number;
  destination: string;
  destination_id: string | null;
  options: ReportOptions;
}

type Labelled = Map<string, { record: SourceRecord; text: string }>;

const PROMPT_SOURCE_CHARS = 3500;

/* ------------------------------------------------------------------ prompts */

const EXTRACTION_RULES = `Extraction rules:
- Use ONLY the numbered sources provided. Every claim must cite at least one source label (e.g. "S3") with a verbatim quote: a contiguous passage of 8 to 40 words copied exactly from that source's text.
- One atomic, specific fact per claim, written in your own clear words. No claim without a supporting quote. If the sources do not support something, omit it rather than guess.
- Never infer India-specific popularity from general international fame.
- Keep dates, numbers and reporting periods exactly as the source states them; set reporting_period for statistics.
- Prefer official and primary sources when several support the same fact.`;

const GROUP_TASK: Record<GroupKey, string> = {
  snapshot:
    "Fill the destination snapshot: geographic location, a one-paragraph overview, why travellers visit, main experiences, relevant seasons, practical travel considerations, typical suggested trip duration, entry requirements for Indian passport holders (official sources only; leave empty if no official source), and verified connectivity from India (airline routes, direct flights).",
  india:
    "Analyse Indian traveller awareness. documented = evidence specifically about Indian travellers (arrivals, Indian interest, India-market statements). general_popularity = attractions famous internationally (NOT evidence of Indian awareness). entertainment_links = film/entertainment connections with India. india_evidence = published Indian arrival or demand data. barriers = travel barriers relevant to Indians. segments = relevant Indian traveller segments (your analysis). hypotheses = strategy hypotheses (your analysis, clearly not facts).",
  places:
    "beyond = 10 to 15 under-promoted places or experiences less common in mainstream itineraries (do not call them 'hidden gems' or claim Indians don't know them unless a source says so). top = 10 to 15 major attractions or activities. For each give name, exact location, description, and where supported: why special, what makes it different, activities, suitable traveller segment, seasonality, accessibility, India relevance, why famous. Each place needs at least one sourced claim. Avoid repeating the same place in both lists.",
  cnf:
    "culture = themed groups (e.g. History, Festivals, Architecture, Art and crafts, Music, Religious sites, Living traditions) of sourced claims, respectful and accurate. nature = themed groups (e.g. Hiking, Beaches and islands, Wildlife, Road trips, Natural phenomena) and flag permits, seasonality and safety restrictions; only visitor-accessible experiences. food = dishes, culinary experiences (markets, classes, trails), vegetarian availability (only when a source supports it), and notes.",
  facts_board:
    "facts = up to 14 memorable, surprising, verifiable facts (geography, history, culture, food, wildlife, architecture, phenomena) useful for creative campaigns. board = the official tourism authority: organisation, website, current positioning, recent campaigns, India-specific activity, published priorities, partnerships with OTAs/airlines. Do not invent an active partnership opportunity.",
};

function sourceBlock(labelled: Labelled) {
  return [...labelled.entries()]
    .map(([label, s]) => {
      const meta = `[${label}] ${s.record.title} | ${s.record.publisher} | ${s.record.source_type.replace("_", " ")} | published ${s.record.published_at ? fmtDate(s.record.published_at) : "unknown"}`;
      return `${meta}\n${asUntrustedBlock(label, s.text.slice(0, PROMPT_SOURCE_CHARS))}`;
    })
    .join("\n\n");
}

function extractionPrompt(group: GroupKey, input: ResearchJobInput, labelled: Labelled) {
  return [
    `Destination: ${input.destination}`,
    `Perspective: Indian outbound travellers. Traveller focus: ${input.options.traveller_type}. Travel period: ${input.options.travel_period || "Any season"}.`,
    `Task: ${GROUP_TASK[group]}`,
    EXTRACTION_RULES,
    `Sources:\n\n${sourceBlock(labelled)}`,
  ].join("\n\n");
}

/* ------------------------------------------------------------------ job */

export async function runResearchJob(job: ResearchJob): Promise<void> {
  const input = job.input as unknown as ResearchJobInput;
  const store = db();
  const report = await store.get("reports", input.report_id);
  if (!report) throw new Error("The report for this job no longer exists.");
  const hadContent = Boolean(report.content);
  try {
    await research(job, input, report);
  } catch (e) {
    // Restore the previous version on a failed refresh; mark first-time research as failed.
    await store.update("reports", report.id, {
      status: hadContent ? (report.partial_notes.length ? "partial" : "completed") : "failed",
      updated_at: nowIso(),
    });
    throw e;
  }
}

async function research(job: ResearchJob, input: ResearchJobInput, report: Report) {
  const store = db();
  const userId = job.created_by;
  const notes: string[] = [];
  const subjectId = `${report.id}:v${input.version}`;
  const destination: Destination | null = input.destination_id ? await store.get("destinations", input.destination_id) : null;
  const settings = await getSettings();
  const officialHosts = [destination?.board_website, destination?.india_page, ...settings.preferred_domains].filter(Boolean) as string[];

  /* 1. Finding sources */
  await setJobStage(job.id, "finding_sources", `Finding sources for ${input.destination}`);
  const plan = buildQueryPlan(input.destination, destination?.tourism_board ?? null, input.options);
  const deep = input.options.depth === "comprehensive";
  const byGroup = new Map<GroupKey, SearchResult[]>();
  await pool(plan, 4, async (q) => {
    try {
      const results = await webSearch(q.query, { topic: q.topic, days: q.days, maxResults: deep ? 5 : 4, deep, userId });
      byGroup.set(q.group, [...(byGroup.get(q.group) ?? []), ...results]);
    } catch (e) {
      if (e instanceof NotConfiguredError) throw e;
      notes.push(`Search failed for "${q.query}": ${(e as Error).message}`);
    }
  });
  const groups = new Map<GroupKey, Labelled>();
  const allSources = new Map<string, SourceRecord>();
  for (const [g, results] of byGroup) {
    if (!results.length) continue;
    const stored = await storeSources(results.slice(0, deep ? 14 : 8), officialHosts);
    stored.forEach((s) => allSources.set(s.record.id, s.record));
    groups.set(g, labelSources(stored));
  }
  if (!allSources.size) throw new Error("No sources could be retrieved. Check the search provider configuration or try a more specific destination name.");
  await setJobStage(job.id, "finding_sources", `Found ${allSources.size} sources`);

  /* 2. Extracting facts */
  await setJobStage(job.id, "extracting_facts");
  const extracted: {
    snapshot?: SnapshotOut;
    india?: IndiaOut;
    places?: PlacesOut;
    cnf?: CnfOut;
    facts_board?: FactsBoardOut;
  } = {};
  const tasks: { group: GroupKey; schema: ZodType<unknown>; fixture: (l: Labelled) => unknown }[] = [
    { group: "snapshot", schema: SnapshotExtraction as ZodType<unknown>, fixture: (l) => demo.demoSnapshot(l, input.destination) },
    { group: "india", schema: IndiaExtraction as ZodType<unknown>, fixture: (l) => demo.demoIndia(l) },
    { group: "places", schema: PlacesExtraction as ZodType<unknown>, fixture: (l) => demo.demoPlaces(l) },
    { group: "cnf", schema: CultureNatureFoodExtraction as ZodType<unknown>, fixture: (l) => demo.demoCnf(l) },
    { group: "facts_board", schema: FactsBoardExtraction as ZodType<unknown>, fixture: (l) => demo.demoFactsBoard(l, input.destination) },
  ];
  const extractedLog: string[] = [];
  await pool(tasks, 3, async (t) => {
    const labelled = groups.get(t.group);
    if (!labelled) {
      notes.push(`${GROUP_LABEL[t.group]}: no sources were found, so this section is incomplete.`);
      return;
    }
    try {
      const out = await generateStructured({
        task: `research.${t.group}`,
        schema: t.schema,
        system: "You are a meticulous travel research analyst extracting sourced facts for an internal destination report.",
        user: extractionPrompt(t.group, input, labelled),
        userId,
        fixture: () => t.fixture(labelled),
      });
      (extracted as Record<string, unknown>)[t.group] = out;
      extractedLog.push(`Extracted: ${GROUP_LABEL[t.group]}`);
    } catch (e) {
      if (e instanceof NotConfiguredError) throw e;
      notes.push(`${GROUP_LABEL[t.group]}: extraction failed (${(e as Error).message}).`);
    }
  });
  // Stage log written sequentially (parallel writes to the same job row could drop entries).
  for (const m of extractedLog) await setJobStage(job.id, "extracting_facts", m);
  if (!Object.keys(extracted).length) throw new Error(`No section could be extracted. ${notes.join(" ")}`);

  /* 3. Verifying */
  await setJobStage(job.id, "verifying", "Checking every quote against the retrieved sources");
  const claims: Claim[] = [];
  const subject = { type: "report" as const, id: subjectId };
  const verify = (group: GroupKey, section: string, d: ClaimDraftInput | null | undefined): Claim | null => {
    if (!d) return null;
    const labelled = groups.get(group);
    if (!labelled) return null;
    const draft: DraftClaim = { text: d.text, section, refs: d.refs, reporting_period: d.reporting_period ?? null };
    const c = verifyDraft(draft, subject, labelled);
    claims.push(c);
    return c;
  };
  const usable = (c: Claim | null): c is Claim => Boolean(c && c.status !== "Unverified");
  const st = (c: Claim): SourcedText => ({ text: c.text, claim_ids: [c.id] });
  const list = (group: GroupKey, section: string, arr: ClaimDraftInput[] | undefined) => (arr ?? []).map((d) => verify(group, section, d)).filter(usable).map(st);
  const one = (group: GroupKey, section: string, d: ClaimDraftInput | null | undefined, fallback = ""): SourcedText => {
    const c = verify(group, section, d);
    return usable(c) ? st(c) : { text: fallback, claim_ids: [] };
  };

  const sn = extracted.snapshot;
  const ind = extracted.india;
  const pl = extracted.places;
  const cnf = extracted.cnf;
  const fb = extracted.facts_board;

  const snapshot: ReportContent["snapshot"] = {
    location: one("snapshot", "snapshot.location", sn?.location),
    overview: one("snapshot", "snapshot.overview", sn?.overview),
    why_visit: list("snapshot", "snapshot.why_visit", sn?.why_visit),
    experiences: list("snapshot", "snapshot.experiences", sn?.experiences),
    seasons: list("snapshot", "snapshot.seasons", sn?.seasons),
    considerations: list("snapshot", "snapshot.considerations", sn?.considerations),
    trip_duration: one("snapshot", "snapshot.trip_duration", sn?.trip_duration),
    entry_requirements: list("snapshot", "snapshot.entry_requirements (visa)", sn?.entry_requirements),
    connectivity: list("snapshot", "snapshot.connectivity (flights)", sn?.connectivity),
    hero_image: null,
  };

  const documented = list("india", "indians_know.documented", ind?.documented);
  const indiansKnow: ReportContent["indians_know"] = {
    documented,
    general_popularity: list("india", "indians_know.general_popularity", ind?.general_popularity),
    entertainment_links: list("india", "indians_know.entertainment_links", ind?.entertainment_links),
    awareness_note: documented.length
      ? `${documented.length} India-specific finding(s) are documented. Items under "Internationally famous" show global popularity, which is not evidence of Indian awareness.`
      : "India-specific awareness not established.",
  };

  const toPlaces = (drafts: PlaceDraft[] | undefined, section: string): PlaceItem[] =>
    (drafts ?? [])
      .map((p) => {
        const cs = p.claims.map((d) => verify("places", `${section}: ${p.name}`, d)).filter(usable);
        if (!cs.length) return null;
        const { claims: _c, ...rest } = p;
        return { ...rest, image: null, claim_ids: cs.map((c) => c.id) } as PlaceItem;
      })
      .filter(Boolean) as PlaceItem[];
  const beyond = toPlaces(pl?.beyond, "beyond_itinerary").slice(0, 15);
  const beyondNames = new Set(beyond.map((p) => p.name.toLowerCase()));
  const top = toPlaces(pl?.top, "top_things")
    .filter((p) => !beyondNames.has(p.name.toLowerCase()))
    .slice(0, 15);

  const themed = (section: string, groupsIn: { heading: string; items: ClaimDraftInput[] }[] | undefined) =>
    (groupsIn ?? []).map((g) => ({ heading: g.heading, items: list("cnf", `${section}.${g.heading}`, g.items) })).filter((g) => g.items.length);

  const factClaims = (fb?.facts ?? []).map((d) => verify("facts_board", "surprising_facts", d)).filter((c): c is Claim => Boolean(c && (c.status === "Verified" || c.status === "Corroborated")));
  const facts = factClaims.slice(0, 8).map(st);
  const facts_gap_note =
    facts.length < 8
      ? `Only ${facts.length} surprising fact${facts.length === 1 ? "" : "s"} could be verified or corroborated against retrieved sources. We have not added unverified facts to reach eight.`
      : null;

  const boardOrg = one("facts_board", "board_intel.organisation", fb?.board.organisation);
  const board_intel: ReportContent["board_intel"] = {
    organisation: boardOrg.text ? boardOrg : { text: destination?.tourism_board ?? "Tourism authority not identified from sources", claim_ids: [] },
    website: destination?.board_website ?? (fb?.board.website || null),
    positioning: list("facts_board", "board_intel.positioning (campaign)", fb?.board.positioning),
    recent_campaigns: list("facts_board", "board_intel.recent_campaigns (campaign)", fb?.board.recent_campaigns),
    india_activity: list("facts_board", "board_intel.india_activity (campaign)", fb?.board.india_activity),
    priorities: list("facts_board", "board_intel.priorities", fb?.board.priorities),
    partnerships: list("facts_board", "board_intel.partnerships (campaign)", fb?.board.partnerships),
    note: boardOrg.text
      ? "Tourism-board activity listed here is sourced. Any partnership opportunity is a hypothesis, not a confirmed opening."
      : "The organisation name comes from the internal destination directory and has not been verified against sources in this run. Partnership opportunities are hypotheses.",
  };

  const india_relevance: ReportContent["india_relevance"] = {
    evidence: list("india", "india_relevance.evidence (statistic)", ind?.india_evidence),
    segments: ind?.segments ?? [],
    barriers: list("india", "india_relevance.barriers", ind?.barriers),
    hypotheses: ind?.hypotheses ?? [],
  };

  const culture = themed("culture", cnf?.culture);
  const nature = themed("nature", cnf?.nature);
  const food: ReportContent["food"] = {
    dishes: list("cnf", "food.dishes", cnf?.food.dishes),
    experiences: list("cnf", "food.experiences", cnf?.food.experiences),
    vegetarian: list("cnf", "food.vegetarian", cnf?.food.vegetarian),
    notes: list("cnf", "food.notes", cnf?.food.notes),
  };

  await db().insertMany("claims", claims);
  const unverified = claims.filter((c) => c.status === "Unverified").length;
  await setJobStage(job.id, "verifying", `Checked ${claims.length} claims (${claims.length - unverified} supported, ${unverified} unsupported and held back)`);

  /* 4. Generating report */
  await setJobStage(job.id, "generating_report");
  const supported = claims.filter((c) => c.status !== "Unverified");
  let synthesis: SynthesisOut | null = null;
  try {
    synthesis = await generateStructured({
      task: "research.synthesis",
      schema: SynthesisSchema,
      system:
        "You are a senior travel-marketing strategist. Write an executive summary that only restates the supported findings given, then strategic recommendations. Recommendations are interpretation, not fact: never present them as tourism-board statements, and only reference Scapia capabilities as potential touchpoints (in-app destination pages, banners, push, email, creator content), not as existing features.",
      user: [
        `Destination: ${input.destination}. Audience: Indian outbound travellers (${input.options.traveller_type}). Period: ${input.options.travel_period || "Any season"}.`,
        `Supported findings (already verified):\n${supported.slice(0, 120).map((c) => `- [${c.section}] ${c.text}`).join("\n")}`,
        "Return executive_summary (120 to 220 words, factual, no new facts) and campaign_summary: exactly three strongest opportunities, three creative territories, target segments, potential Scapia touchpoints, practical constraints, and one recommended next step.",
      ].join("\n\n"),
      userId,
      fixture: () => demo.demoSynthesis(input.destination),
    });
  } catch (e) {
    if (e instanceof NotConfiguredError) throw e;
    notes.push(`Strategic synthesis failed (${(e as Error).message}).`);
  }

  // Photography: hero, places, gallery (licensed only, never an unrelated image).
  const withTimeout = <T,>(p: Promise<T>, ms = 12000) => Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
  const hero = await withTimeout(findPhoto(destination?.photo_query ?? `${input.destination} landscape`, { file: destination?.photo_file, alt: input.destination }));
  snapshot.hero_image = (hero as ImageRef | null) ?? null;
  await pool([...beyond, ...top], 4, async (p) => {
    p.image = ((await withTimeout(findPhoto(`${p.name} ${input.destination}`, { alt: `${p.name}, ${p.location || input.destination}` }))) as ImageRef | null) ?? null;
  });
  const gallery = [snapshot.hero_image, ...beyond.map((p) => p.image), ...top.map((p) => p.image)].filter((x): x is ImageRef => Boolean(x));
  const uniqGallery = gallery.filter((g, i) => gallery.findIndex((x) => x.url === g.url) === i).slice(0, 7);

  const content: ReportContent = {
    snapshot,
    indians_know: indiansKnow,
    beyond_itinerary: beyond,
    culture,
    nature,
    food,
    top_things: top,
    surprising_facts: facts,
    facts_gap_note,
    india_relevance,
    board_intel,
    campaign_summary: synthesis?.campaign_summary ?? { opportunities: [], territories: [], segments: [], scapia_touchpoints: [], constraints: [], next_step: "" },
    executive_summary: synthesis?.executive_summary ?? (snapshot.overview.text || "Executive summary unavailable for this run."),
    gallery: uniqGallery,
  };

  if (beyond.length < 10) notes.push(`Only ${beyond.length} under-promoted places had verifiable sources (target 10 to 15).`);
  if (top.length < 10) notes.push(`Only ${top.length} top attractions had verifiable sources (target 10 to 15).`);
  if (!snapshot.entry_requirements.length) notes.push("Entry requirements for Indian passport holders could not be supported by a retrieved source. Check the official immigration website.");

  // Sources: cited first, then other retrieved sources.
  const cited = new Set(claims.flatMap((c) => c.evidence.filter((e) => e.quote_found).map((e) => e.source_id)));
  const sourceIds = [...allSources.keys()].sort((a, b) => Number(cited.has(b)) - Number(cited.has(a)));
  const health = computeHealth(claims, [...allSources.values()].filter((s) => cited.has(s.id)));
  const isDemo = [...allSources.values()].some((s) => s.is_demo);

  const prev = (await store.list("report_versions", { where: { report_id: report.id } as never, orderBy: { column: "version" } }))[0] ?? null;
  const prevClaims = prev ? await store.list("claims", { where: { subject_type: "report", subject_id: `${report.id}:v${prev.version}` } as never }) : [];
  const change_summary = summariseChanges(prev, prevClaims, content, claims, sourceIds, health);

  const finalStatus = notes.length ? "partial" : "completed";
  await store.insert("report_versions", {
    id: newId("rv_"),
    report_id: report.id,
    version: input.version,
    content,
    source_ids: sourceIds,
    health,
    change_summary,
    created_at: nowIso(),
  });
  await store.update("reports", report.id, {
    version: input.version,
    status: finalStatus,
    content,
    source_ids: sourceIds,
    health,
    partial_notes: notes,
    updated_at: nowIso(),
    is_demo: isDemo,
  });
  await setJobStage(job.id, "completed", finalStatus === "partial" ? `Completed with ${notes.length} gap(s)` : "Completed", { result_id: report.id, error: null });
}

async function pool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (i < items.length) {
        const item = items[i++];
        await fn(item);
      }
    }),
  );
}
