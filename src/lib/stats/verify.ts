import "server-only";
import { db, newId, nowIso } from "@/lib/db";
import { webSearch, type SearchResult } from "@/lib/search";
import { classifySourceType, isPrimary } from "@/lib/evidence";
import { hostOf } from "@/lib/security/content";
import type { ClaimStatus, OutboundStat } from "@/lib/types";
import { textStatesNumber } from "./numbers";

/** Official statistics publishers that aren't caught by the government-domain rule. */
const OFFICIAL_STATS_HOSTS = ["tatnews.org", "japan.travel", "visitsingapore.com", "vietnam.travel", "vietnamtourism.gov.vn", "dubaidet.gov.ae", "visitdubai.com", "tourism.australia.com", "tourismnewzealand.com"];

export interface StatCheck {
  id: string;
  label: string;
  status: ClaimStatus;
  previous: ClaimStatus;
  reason: string;
  matched: { url: string; title: string; publisher: string; primary: boolean }[];
  demo: boolean;
}

function supports(stat: OutboundStat, r: SearchResult) {
  const text = `${r.title} ${r.content}`;
  if (!textStatesNumber(text, stat.value)) return false;
  const lower = text.toLowerCase();
  const isOutbound = /india \(outbound/i.test(stat.destination);
  const placeOk = isOutbound ? /depart|outbound/.test(lower) : lower.includes(stat.destination.toLowerCase());
  return placeOk && /india/.test(lower);
}

/**
 * Deterministic check of one statistic: the figure must appear (in any common format) on a page
 * that also names the destination and India. Primary source match = Verified (and the stat is
 * re-pointed at that official page); 2+ independent domains = Corroborated; otherwise unchanged.
 */
export async function verifyStat(stat: OutboundStat, userId: string): Promise<StatCheck> {
  const dests = await db().list("destinations", { limit: 300 });
  const dest = dests.find((d) => d.name.toLowerCase() === stat.destination.toLowerCase());
  const officialHosts = [...OFFICIAL_STATS_HOSTS, dest?.board_website, dest?.india_page].filter(Boolean) as string[];
  const year = stat.reporting_period.match(/20\d\d/)?.[0] ?? "";
  const isOutbound = /india \(outbound/i.test(stat.destination);
  const queries = [
    isOutbound ? `Indian nationals departures ${year} Ministry of Tourism India statistics` : `Indian visitor arrivals ${stat.destination} ${year} official statistics`,
    `${stat.source_title}`,
  ];
  const results: SearchResult[] = [];
  results.push(...(await webSearch(queries[0], { userId, maxResults: 6, deep: true })));
  const srcHost = hostOf(stat.source_url);
  results.push(...(await webSearch(queries[1], { userId, maxResults: 4, deep: true, includeDomains: srcHost ? [srcHost] : undefined })));

  const demo = results.some((r) => r.provider === "demo");
  const seen = new Set<string>();
  const matched: StatCheck["matched"] = [];
  for (const r of results) {
    if (seen.has(r.url)) continue;
    seen.add(r.url);
    if (supports(stat, r)) matched.push({ url: r.url, title: r.title, publisher: r.publisher, primary: isPrimary(classifySourceType(r.url, officialHosts)) });
  }
  const hosts = new Set(matched.map((m) => hostOf(m.url)));
  const primary = matched.find((m) => m.primary);
  let status: ClaimStatus = stat.status;
  let reason: string;
  if (primary) {
    status = "Verified";
    reason = `Figure found on an official source (${primary.publisher}).`;
  } else if (hosts.size >= 2) {
    status = "Corroborated";
    reason = `Figure found on ${hosts.size} independent sources; no official page matched in this check.`;
  } else if (hosts.size === 1) {
    reason = `Figure found on one non-official source (${[...hosts][0]}); still needs an official source.`;
  } else {
    reason = `Figure not found in ${seen.size} retrieved pages. Status unchanged; open the source to check.`;
  }
  return { id: stat.id, label: `${stat.metric}, ${stat.destination}, ${stat.reporting_period}`, status, previous: stat.status, reason, matched, demo };
}

/** Persist a check (never in demo mode). Only upgrades status; a failed check never invents a downgrade. */
export async function applyStatCheck(stat: OutboundStat, c: StatCheck, actor: string) {
  if (c.demo) return stat;
  const primary = c.matched.find((m) => m.primary);
  const repoint =
    primary && primary.url !== stat.source_url
      ? { source_url: primary.url, source_title: primary.title, publisher: primary.publisher, source_type: classifySourceType(primary.url), notes: `${stat.notes} Previously cited: ${stat.source_url}`.trim() }
      : {};
  const updated = await db().update("outbound_stats", stat.id, { ...repoint, status: c.status, verified_at: nowIso() });
  await db().insert("verification_events", { id: newId(), subject_type: "claim", subject_id: stat.id, status: c.status, note: c.reason, actor: `${actor} (automatic check)`, created_at: nowIso() });
  return updated ?? stat;
}
