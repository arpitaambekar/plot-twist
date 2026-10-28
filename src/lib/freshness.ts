import type { Claim, FreshnessClass } from "@/lib/types";

/** Maximum age (days) before a verified fact should be re-checked, by information type. */
export const FRESHNESS_DAYS: Record<FreshnessClass, number> = {
  visa: 30,
  connectivity: 45,
  contact: 90,
  event: 30,
  statistic: 180,
  campaign: 120,
  general: 365,
  historical: 1095,
};

export const FRESHNESS_LABEL: Record<FreshnessClass, string> = {
  visa: "Visa and entry policy: re-check monthly",
  connectivity: "Flights and connectivity: re-check every 6 weeks",
  contact: "Contacts: re-check quarterly",
  event: "Event schedules: verify before the event",
  statistic: "Statistics: update with new official releases",
  campaign: "Campaign activity: re-check every 4 months",
  general: "General travel facts: re-check yearly",
  historical: "Historical facts: re-check every 3 years",
};

export function isStale(c: Pick<Claim, "freshness_class" | "verified_at" | "created_at">, now = Date.now()) {
  const ref = c.verified_at ?? c.created_at;
  const age = (now - new Date(ref).getTime()) / 86400000;
  return age > FRESHNESS_DAYS[c.freshness_class];
}

/** Classify a claim's information type from its section and wording. */
export function classifyFreshness(section: string, text: string): FreshnessClass {
  const t = `${section} ${text}`.toLowerCase();
  if (/visa|entry requirement|passport|e-visa|immigration/.test(t)) return "visa";
  if (/flight|airline|route|non-stop|direct service|connectivity/.test(t)) return "connectivity";
  if (/arrivals|visitors|growth|per cent|percent|%|statistic|million|tourists from india/.test(t)) return "statistic";
  if (/festival|event|takes place|held (in|on|every)|celebrat/.test(t)) return "event";
  if (/campaign|launched|ambassador|roadshow|partnership/.test(t)) return "campaign";
  if (/century|founded|built in|dynasty|ancient|history|heritage/.test(t)) return "historical";
  return "general";
}
