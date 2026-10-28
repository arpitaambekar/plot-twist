import "server-only";
import { db, newId, nowIso } from "@/lib/db";
import type { Claim, ClaimStatus, ReportHealth, SourceRecord, SourceType } from "@/lib/types";
import type { SearchResult } from "@/lib/search";
import { hostOf, isOfficialDomain, quoteAppearsIn } from "@/lib/security/content";
import { classifyFreshness, isStale } from "@/lib/freshness";

const TRADE_HOSTS = ["travel.economictimes.indiatimes.com", "travelbizmonitor.com", "traveltradejournal.com", "skift.com", "ttgasia.com", "ttgmena.com", "breakingtravelnews.com", "traveldailynews.com", "travelandtourworld.com", "phocuswire.com", "tourism-review.com", "hospitalitynet.org"];
const AIRLINE_HINTS = /(airlines?|airways|aviation|air(india|asia)|emirates|qatarairways|singaporeair|indigo|goindigo|vietjet|lufthansa|klm|airfrance)/;
const NEWS_HOSTS = ["reuters.com", "bbc.co.uk", "bbc.com", "thehindu.com", "hindustantimes.com", "indianexpress.com", "livemint.com", "economictimes.indiatimes.com", "timesofindia.indiatimes.com", "business-standard.com", "moneycontrol.com", "ndtv.com", "cnn.com", "theguardian.com", "nytimes.com", "apnews.com", "nikkei.com", "scmp.com", "afaqs.com", "exchange4media.com", "campaignindia.in", "thedrum.com", "adweek.com", "campaignlive.co.uk"];
const REFERENCE_HOSTS = ["wikipedia.org", "britannica.com", "unesco.org", "whc.unesco.org"];

export function classifySourceType(url: string, officialHosts: string[] = []): SourceType {
  const h = hostOf(url);
  if (/\.(gov|gob|gouv|go|govt|gv|admin|nic)\.|\.gov$|\.gc\.ca$/.test(h) || /\.gov\.[a-z]{2}$/.test(h)) return "government";
  if (isOfficialDomain(url, officialHosts)) return "tourism_board";
  if (AIRLINE_HINTS.test(h.replace(/[-.]/g, ""))) return "airline";
  if (TRADE_HOSTS.some((t) => h === t || h.endsWith("." + t))) return "trade";
  if (NEWS_HOSTS.some((t) => h === t || h.endsWith("." + t))) return "news";
  if (REFERENCE_HOSTS.some((t) => h === t || h.endsWith("." + t))) return "reference";
  return "other";
}

export function isPrimary(type: SourceType) {
  return type === "government" || type === "tourism_board" || type === "official" || type === "airline";
}

/** Persist search results as source records (deduplicated by URL). Returns records with full text kept in memory for verification. */
export async function storeSources(results: SearchResult[], officialHosts: string[] = []): Promise<{ record: SourceRecord; text: string }[]> {
  const store = db();
  const out: { record: SourceRecord; text: string }[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    if (seen.has(r.url)) continue;
    seen.add(r.url);
    const existing = (await store.list("sources", { where: { url: r.url } as never, limit: 1 }))[0];
    const record: SourceRecord = existing
      ? { ...existing, retrieved_at: nowIso() }
      : {
          id: newId("src_"),
          url: r.url,
          title: r.title || hostOf(r.url),
          publisher: r.publisher || hostOf(r.url),
          source_type: classifySourceType(r.url, officialHosts),
          published_at: r.published_at,
          retrieved_at: nowIso(),
          excerpt: r.snippet.slice(0, 600),
          is_demo: r.provider === "demo",
        };
    if (r.provider === "demo" && record.url.includes("//gov.")) record.source_type = "government";
    if (existing) await store.update("sources", existing.id, { retrieved_at: record.retrieved_at });
    else await store.insert("sources", record);
    out.push({ record, text: r.content || r.snippet });
  }
  return out;
}

export interface DraftClaim {
  text: string;
  section: string;
  refs: { source: string; quote: string }[];
  reporting_period?: string | null;
}

/**
 * Deterministic verification. The model proposes a claim with supporting quotes; we only accept
 * a quote if it genuinely appears in the retrieved source text. Status is then derived from what
 * was actually found, never from the model's own confidence:
 *  - Verified: found in a primary/official source
 *  - Corroborated: found in 2+ independent domains
 *  - Needs Verification: found in a single non-official source
 *  - Unverified: no supporting passage found
 */
export function verifyDraft(
  draft: DraftClaim,
  subject: { type: Claim["subject_type"]; id: string },
  sources: Map<string, { record: SourceRecord; text: string }>,
): Claim {
  const evidence = draft.refs
    .map((ref) => {
      const s = sources.get(ref.source);
      if (!s) return null;
      return { source_id: s.record.id, quote: ref.quote.slice(0, 500), quote_found: quoteAppearsIn(ref.quote, s.text) };
    })
    .filter(Boolean) as Claim["evidence"];

  const found = evidence.filter((e) => e.quote_found);
  const recs = found.map((e) => [...sources.values()].find((s) => s.record.id === e.source_id)!.record);
  const primary = recs.find((r) => isPrimary(r.source_type));
  const hosts = new Set(recs.map((r) => hostOf(r.url)));

  let status: ClaimStatus;
  let reason: string;
  if (!found.length) {
    status = "Unverified";
    reason = evidence.length ? "The cited passage was not found in the retrieved source text." : "No supporting source was provided.";
  } else if (primary) {
    status = "Verified";
    reason = `Supported by a primary source (${primary.publisher}).`;
  } else if (hosts.size >= 2) {
    status = "Corroborated";
    reason = `Supported by ${hosts.size} independent sources.`;
  } else {
    status = "Needs Verification";
    reason = "Supported by a single non-official source.";
  }

  return {
    id: newId("clm_"),
    subject_type: subject.type,
    subject_id: subject.id,
    section: draft.section,
    text: draft.text,
    status,
    status_reason: reason,
    evidence,
    reporting_period: draft.reporting_period ?? null,
    freshness_class: classifyFreshness(draft.section, draft.text),
    verified_at: nowIso(),
    created_at: nowIso(),
  };
}

/** Research health, computed only from stored evidence (never AI-estimated). */
export function computeHealth(claims: Claim[], sources: SourceRecord[]): ReportHealth {
  const by_status: Record<ClaimStatus, number> = { Verified: 0, Corroborated: 0, "Needs Verification": 0, Unverified: 0 };
  for (const c of claims) by_status[c.status]++;
  const evidenced = claims.filter((c) => c.evidence.some((e) => e.quote_found)).length;
  return {
    total_claims: claims.length,
    evidenced_claims: evidenced,
    evidence_pct: claims.length ? Math.round((evidenced / claims.length) * 100) : 0,
    unresolved_claims: by_status["Needs Verification"] + by_status.Unverified,
    stale_claims: claims.filter((c) => isStale(c)).length,
    source_count: sources.length,
    official_source_count: sources.filter((s) => isPrimary(s.source_type)).length,
    by_status,
    computed_at: nowIso(),
  };
}

/** Number sources S1..Sn for prompts, so the model can only cite what we retrieved. */
export function labelSources(items: { record: SourceRecord; text: string }[]) {
  const map = new Map<string, { record: SourceRecord; text: string }>();
  items.forEach((s, i) => map.set(`S${i + 1}`, s));
  return map;
}
