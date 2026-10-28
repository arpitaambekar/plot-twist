import type { ReportOptions } from "@/lib/types";

export type GroupKey = "snapshot" | "india" | "places" | "cnf" | "facts_board";

export interface QueryPlan {
  group: GroupKey;
  query: string;
  topic?: "general" | "news";
  days?: number;
}

export const GROUP_LABEL: Record<GroupKey, string> = {
  snapshot: "Snapshot, entry and connectivity",
  india: "Indian traveller awareness and demand",
  places: "Places beyond the usual itinerary and top attractions",
  cnf: "Culture, nature and food",
  facts_board: "Surprising facts and tourism-board intelligence",
};

/** Section-specific research queries. Quick depth uses the first two per group. */
export function buildQueryPlan(destination: string, board: string | null, opts: ReportOptions): QueryPlan[] {
  const d = destination;
  const who = opts.traveller_type !== "All" ? ` for ${opts.traveller_type.toLowerCase()}` : "";
  const when = opts.travel_period && opts.travel_period !== "Any season" ? ` in ${opts.travel_period}` : "";
  const b = board ?? `${d} tourism board`;
  const plan: Record<GroupKey, QueryPlan[]> = {
    snapshot: [
      { group: "snapshot", query: `${d} official tourism travel guide overview` },
      { group: "snapshot", query: `${d} visa entry requirements Indian passport holders official` },
      { group: "snapshot", query: `direct flights from India to ${d} airline route` },
      { group: "snapshot", query: `best time to visit ${d}${when} seasons weather` },
    ],
    india: [
      { group: "india", query: `Indian tourist arrivals ${d} 2025 statistics` },
      { group: "india", query: `${d} popular with Indian travellers` },
      { group: "india", query: `${d} Bollywood Indian film shooting location` },
      { group: "india", query: `${d} tourism India market growth Indian visitors` , topic: "news", days: 365 },
    ],
    places: [
      { group: "places", query: `${d} lesser-known places off the beaten path${who}` },
      { group: "places", query: `${d} top attractions things to do${who}` },
      { group: "places", query: `${d} underrated regions hidden destinations` },
    ],
    cnf: [
      { group: "cnf", query: `${d} culture traditions festivals heritage sites` },
      { group: "cnf", query: `${d} traditional food dishes vegetarian options` },
      { group: "cnf", query: `${d} hiking national parks nature adventure permits safety${when}` },
      { group: "cnf", query: `${d} art crafts music architecture local traditions` },
    ],
    facts_board: [
      { group: "facts_board", query: `${d} surprising interesting facts` },
      { group: "facts_board", query: `${b} India campaign marketing`, topic: "news", days: 730 },
      { group: "facts_board", query: `${b} India roadshow partnership airline OTA` },
      { group: "facts_board", query: `${b} strategy priorities marketing campaign` },
    ],
  };
  const take = opts.depth === "quick" ? 2 : 4;
  return (Object.keys(plan) as GroupKey[]).flatMap((g) => plan[g].slice(0, take));
}
