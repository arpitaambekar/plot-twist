import "server-only";
import { env, NotConfiguredError } from "@/lib/env";
import { hostOf, safeUrl, sanitizeExternalText } from "@/lib/security/content";
import { checkDailyLimit, recordUsage } from "@/lib/security/rate-limit";
import { getSettings } from "@/lib/settings";
import { demoSearch } from "@/lib/fixtures/search";

export interface SearchResult {
  url: string;
  title: string;
  /** Sanitised page text (raw content when the provider returns it, else the snippet). */
  content: string;
  snippet: string;
  published_at: string | null;
  publisher: string;
  image: string | null;
  provider: "tavily" | "brave" | "demo";
}

export interface SearchOptions {
  topic?: "general" | "news";
  /** Restrict news to the last N days. */
  days?: number;
  maxResults?: number;
  includeDomains?: string[];
  /** Pull fuller page text (Tavily include_raw_content). */
  deep?: boolean;
  userId: string;
}

export function searchConfigured() {
  return Boolean(env.tavilyKey || env.braveKey || env.demoFixtures);
}

export async function webSearch(query: string, opts: SearchOptions): Promise<SearchResult[]> {
  if (env.demoFixtures && !env.tavilyKey && !env.braveKey) return demoSearch(query, opts);
  if (!env.tavilyKey && !env.braveKey) {
    throw new NotConfiguredError("search", "Live research needs a search provider. Add TAVILY_API_KEY (recommended) or BRAVE_SEARCH_API_KEY.");
  }
  await checkDailyLimit(opts.userId, "search");
  const settings = await getSettings();
  const results = env.tavilyKey ? await tavily(query, opts) : await brave(query, opts);
  await recordUsage(opts.userId, "search", 1, { query, provider: env.tavilyKey ? "tavily" : "brave" });
  const blocked = new Set(settings.blocked_domains.map((d) => d.replace(/^www\./, "")));
  const preferred = settings.preferred_domains.map((d) => d.replace(/^www\./, ""));
  const isPreferred = (url: string) => preferred.some((d) => hostOf(url) === d || hostOf(url).endsWith("." + d));
  const seen = new Set<string>();
  const kept = results.filter((r) => {
    const key = r.url.replace(/[?#].*$/, "").replace(/\/$/, "");
    if (seen.has(key) || blocked.has(hostOf(r.url))) return false;
    seen.add(key);
    return true;
  });
  // Admin-preferred sources are ranked first (stable order otherwise).
  return [...kept.filter((r) => isPreferred(r.url)), ...kept.filter((r) => !isPreferred(r.url))];
}

async function tavily(query: string, opts: SearchOptions): Promise<SearchResult[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.tavilyKey}` },
    body: JSON.stringify({
      query,
      topic: opts.topic ?? "general",
      days: opts.topic === "news" ? (opts.days ?? 30) : undefined,
      max_results: opts.maxResults ?? 6,
      search_depth: opts.deep ? "advanced" : "basic",
      include_raw_content: Boolean(opts.deep),
      include_images: false,
      include_domains: opts.includeDomains?.length ? opts.includeDomains : undefined,
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`Search provider (Tavily) returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { results?: { url: string; title: string; content: string; raw_content?: string | null; published_date?: string }[] };
  return (body.results ?? [])
    .map((r) => {
      const url = safeUrl(r.url);
      if (!url) return null;
      const snippet = sanitizeExternalText(r.content ?? "", 1200);
      return {
        url,
        title: sanitizeExternalText(r.title ?? "", 300),
        snippet,
        content: sanitizeExternalText(r.raw_content || r.content || "", opts.deep ? 9000 : 2000),
        published_at: normaliseDate(r.published_date),
        publisher: hostOf(url),
        image: null,
        provider: "tavily" as const,
      };
    })
    .filter(Boolean) as SearchResult[];
}

async function brave(query: string, opts: SearchOptions): Promise<SearchResult[]> {
  const endpoint = opts.topic === "news" ? "news/search" : "web/search";
  const params = new URLSearchParams({ q: query, count: String(opts.maxResults ?? 8), extra_snippets: "true" });
  if (opts.topic === "news" && opts.days) params.set("freshness", opts.days <= 1 ? "pd" : opts.days <= 7 ? "pw" : opts.days <= 31 ? "pm" : "py");
  const res = await fetch(`https://api.search.brave.com/res/v1/${endpoint}?${params}`, {
    headers: { Accept: "application/json", "X-Subscription-Token": env.braveKey! },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Search provider (Brave) returned ${res.status}`);
  const body = (await res.json()) as {
    results?: BraveItem[];
    web?: { results?: BraveItem[] };
  };
  const items = body.results ?? body.web?.results ?? [];
  return items
    .map((r) => {
      const url = safeUrl(r.url);
      if (!url) return null;
      const text = [r.description, ...(r.extra_snippets ?? [])].join(" ");
      return {
        url,
        title: sanitizeExternalText(r.title ?? "", 300),
        snippet: sanitizeExternalText(r.description ?? "", 1200),
        content: sanitizeExternalText(text, 3000),
        published_at: normaliseDate(r.page_age ?? null),
        publisher: r.meta_url?.hostname?.replace(/^www\./, "") ?? hostOf(url),
        image: r.thumbnail?.src ?? null,
        provider: "brave" as const,
      };
    })
    .filter(Boolean) as SearchResult[];
}

interface BraveItem {
  url: string;
  title?: string;
  description?: string;
  extra_snippets?: string[];
  page_age?: string;
  meta_url?: { hostname?: string };
  thumbnail?: { src?: string };
}

export function normaliseDate(d: string | null | undefined): string | null {
  if (!d) return null;
  const t = Date.parse(d);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}
