import "server-only";
import { db, nowIso } from "@/lib/db";
import { webSearch, type SearchResult } from "@/lib/search";
import { classifySourceType, isPrimary } from "@/lib/evidence";
import { hostOf, normaliseForMatch } from "@/lib/security/content";
import type { ClaimStatus, ReferenceCampaign } from "@/lib/types";

export interface ReferenceVerification {
  status: ClaimStatus;
  reason: string;
  matched: { url: string; title: string; publisher: string; primary: boolean }[];
  checked: number;
  demo: boolean;
}

/** Distinctive words of a campaign name (drops filler and short words). */
function nameTokens(name: string) {
  const stop = new Set(["the", "and", "for", "with", "campaign", "india", "a", "an", "of", "to", "x"]);
  return normaliseForMatch(name.replace(/\(.*?\)/g, " "))
    .split(" ")
    .filter((w) => w.length > 2 && !stop.has(w));
}

/** A result supports the reference only if its text names the campaign and the board or destination. */
function supports(ref: ReferenceCampaign, r: SearchResult) {
  const text = normaliseForMatch(`${r.title} ${r.content}`);
  const tokens = nameTokens(ref.name);
  if (!tokens.length) return false;
  const hits = tokens.filter((t) => text.includes(t)).length;
  const nameOk = hits / tokens.length >= 0.75;
  const boardWords = normaliseForMatch(ref.tourism_board).split(" ").filter((w) => w.length > 3);
  const ctxOk = text.includes(normaliseForMatch(ref.destination)) || boardWords.some((w) => text.includes(w));
  return nameOk && ctxOk;
}

/**
 * Deterministic re-verification of a library reference:
 *  Verified = supporting text on a primary/official source (government or the board's own domain)
 *  Corroborated = supporting text on 2+ independent domains
 *  Needs Verification = a single non-official source
 *  Unverified = no supporting text found in this check
 * Demo fixture results never change the stored status.
 */
export async function verifyReference(ref: ReferenceCampaign, userId: string): Promise<ReferenceVerification> {
  const dest = (await db().list("destinations", { limit: 200 })).find((d) => d.name.toLowerCase() === ref.destination.toLowerCase());
  const officialHosts = [dest?.board_website, dest?.india_page, ref.official_link].filter(Boolean) as string[];

  const queries = [`"${ref.name.replace(/\(.*?\)/g, "").trim()}" ${ref.tourism_board}`, `${ref.tourism_board} ${ref.name} campaign`];
  const sourceHosts = [...new Set(ref.sources.map((s) => hostOf(s.url)).filter(Boolean))];
  const results: SearchResult[] = [];
  for (const q of queries) results.push(...(await webSearch(q, { userId, maxResults: 6, deep: true })));
  if (sourceHosts.length) results.push(...(await webSearch(`${ref.name} ${ref.tourism_board}`, { userId, maxResults: 6, deep: true, includeDomains: sourceHosts })));

  const demo = results.some((r) => r.provider === "demo");
  const seen = new Set<string>();
  const matched: ReferenceVerification["matched"] = [];
  for (const r of results) {
    if (seen.has(r.url)) continue;
    seen.add(r.url);
    if (!supports(ref, r)) continue;
    matched.push({ url: r.url, title: r.title, publisher: r.publisher, primary: isPrimary(classifySourceType(r.url, officialHosts)) });
  }
  const hosts = new Set(matched.map((m) => hostOf(m.url)));
  const primary = matched.find((m) => m.primary);

  let status: ClaimStatus;
  let reason: string;
  if (primary) {
    status = "Verified";
    reason = `Supporting text found on a primary source (${primary.publisher}).`;
  } else if (hosts.size >= 2) {
    status = "Corroborated";
    reason = `Supporting text found on ${hosts.size} independent sources; no primary source matched.`;
  } else if (hosts.size === 1) {
    status = "Needs Verification";
    reason = "Supporting text found on a single non-official source.";
  } else {
    status = "Unverified";
    reason = `No supporting text found across ${seen.size} retrieved pages in this check.`;
  }
  return { status, reason, matched, checked: seen.size, demo };
}

export async function applyVerification(ref: ReferenceCampaign, v: ReferenceVerification) {
  if (v.demo) return ref;
  const known = new Set(ref.sources.map((s) => s.url));
  const added = v.matched
    .filter((m) => !known.has(m.url))
    .slice(0, 4)
    .map((m) => ({ title: m.title, url: m.url, publisher: m.publisher, published: null }));
  return (await db().update("reference_campaigns", ref.id, { verification: v.status, verified_at: nowIso(), sources: [...ref.sources, ...added] })) ?? ref;
}
