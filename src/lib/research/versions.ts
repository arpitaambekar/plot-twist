import type { Claim, ReportContent, ReportHealth, ReportVersion } from "@/lib/types";

/** Human-readable "what changed" between two report versions, computed from stored claims. */
export function summariseChanges(prev: ReportVersion | null, prevClaims: Claim[], next: ReportContent, nextClaims: Claim[], nextSourceIds: string[], nextHealth: ReportHealth): string {
  if (!prev) return "First version.";
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const before = new Set(prevClaims.filter((c) => c.status !== "Unverified").map((c) => norm(c.text)));
  const after = new Set(nextClaims.filter((c) => c.status !== "Unverified").map((c) => norm(c.text)));
  const added = [...after].filter((t) => !before.has(t)).length;
  const removed = [...before].filter((t) => !after.has(t)).length;
  const parts = [`${added} new or reworded fact${added === 1 ? "" : "s"}`, `${removed} removed`];
  const prevSources = prev.source_ids.length;
  if (prevSources !== nextSourceIds.length) parts.push(`sources ${prevSources} → ${nextSourceIds.length}`);
  if (prev.health) parts.push(`evidence ${prev.health.evidence_pct}% → ${nextHealth.evidence_pct}%`);
  const prevPlaces = prev.content ? prev.content.beyond_itinerary.map((p) => p.name) : [];
  const newPlaces = next.beyond_itinerary.map((p) => p.name).filter((n) => !prevPlaces.includes(n));
  if (newPlaces.length) parts.push(`new places: ${newPlaces.slice(0, 4).join(", ")}${newPlaces.length > 4 ? "…" : ""}`);
  return `Compared with v${prev.version}: ${parts.join("; ")}.`;
}
