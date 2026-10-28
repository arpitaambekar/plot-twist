import type { NewsArticle, NewsCategory } from "@/lib/types";

export const CATEGORY_TABS: { key: NewsCategory | "All"; label: string }[] = [
  { key: "All", label: "All" },
  { key: "Tourism-board campaign", label: "Campaigns" },
  { key: "Board business", label: "Board business" },
  { key: "Indian outbound", label: "Indian outbound" },
  { key: "Connectivity", label: "Connectivity" },
  { key: "Visa & entry", label: "Visa & entry" },
  { key: "Events & festivals", label: "Events" },
  { key: "Investment & development", label: "Investment" },
  { key: "Industry", label: "Industry" },
];

export const SOURCE_TYPE_LABEL: Record<string, string> = {
  official: "Official",
  government: "Government",
  tourism_board: "Tourism board",
  airline: "Airline",
  trade: "Trade press",
  news: "News",
  research: "Research",
  reference: "Reference",
  other: "Other",
};

export type DateRange = "today" | "7" | "30" | "90" | "custom";

export interface NewsFilters {
  category: NewsCategory | "All";
  destination: string;
  continent: string;
  board: string;
  range: DateRange;
  from: string;
  to: string;
  relevance: "" | "High" | "Medium" | "Low";
  sourceType: string;
  savedOnly: boolean;
  q: string;
}

export const DEFAULT_FILTERS: NewsFilters = {
  category: "All",
  destination: "",
  continent: "",
  board: "",
  range: "30",
  from: "",
  to: "",
  relevance: "",
  sourceType: "",
  savedOnly: false,
  q: "",
};

export function applyFilters(news: NewsArticle[], f: NewsFilters, saved: Set<string>, ignoreCategory = false): NewsArticle[] {
  const now = Date.now();
  let start = 0;
  let end = Infinity;
  if (f.range === "today") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    start = d.getTime();
  } else if (f.range === "custom") {
    start = f.from ? new Date(f.from).getTime() : 0;
    end = f.to ? new Date(f.to).getTime() + 86400000 : Infinity;
  } else start = now - Number(f.range) * 86400000;
  const q = f.q.trim().toLowerCase();
  return news.filter((n) => {
    const t = n.published_at ? new Date(n.published_at).getTime() : new Date(n.retrieved_at).getTime();
    if (t < start || t > end) return false;
    if (!ignoreCategory && f.category !== "All" && n.category !== f.category) return false;
    if (f.destination && !n.destinations.includes(f.destination)) return false;
    if (f.continent && n.continent !== f.continent) return false;
    if (f.board && n.tourism_board !== f.board) return false;
    if (f.relevance && n.india_relevance !== f.relevance) return false;
    if (f.sourceType && n.source_type !== f.sourceType) return false;
    if (f.savedOnly && !saved.has(n.id)) return false;
    if (q && !`${n.title} ${n.summary} ${n.source_name}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Editorial ranking for Featured Stories: India relevance, recency, strategic category, imagery. */
export function featuredScore(n: NewsArticle) {
  const ageDays = n.published_at ? (Date.now() - new Date(n.published_at).getTime()) / 86400000 : 30;
  let s = n.india_relevance === "High" ? 4 : n.india_relevance === "Medium" ? 2 : 0;
  s += ageDays <= 3 ? 3 : ageDays <= 7 ? 2 : ageDays <= 14 ? 1 : 0;
  if (["Tourism-board campaign", "Board business", "Connectivity", "Visa & entry"].includes(n.category)) s += 1.5;
  if (n.image) s += 1;
  if (n.why_it_matters) s += 0.5;
  return s;
}

export function sortByDate(news: NewsArticle[]) {
  return [...news].sort((a, b) => (b.published_at ?? b.retrieved_at).localeCompare(a.published_at ?? a.retrieved_at));
}
