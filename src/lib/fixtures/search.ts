import type { SearchResult, SearchOptions } from "@/lib/search";

/**
 * DEMO FIXTURES. Offline stand-ins used only when PLOT_TWIST_DEMO_FIXTURES=true in development,
 * so workflows can be exercised without API keys. Every result is labelled as demo and points at
 * the reserved .invalid domain, so it can never be mistaken for a real source.
 */
export const DEMO_HOST = "demo-fixture.invalid";

export function demoSearch(query: string, opts: SearchOptions): SearchResult[] {
  const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
  const n = Math.min(opts.maxResults ?? 3, 3);
  return Array.from({ length: n }, (_, i) => {
    const official = i === 0;
    const text =
      `[DEMO FIXTURE] This placeholder passage stands in for a real source about ${query}. ` +
      `Demo statement ${i + 1} about ${query} exists only to exercise the research pipeline offline. ` +
      `It is not travel information and must not be used in real work.`;
    return {
      url: `https://${official ? "gov." : ""}${DEMO_HOST}/${slug}/${i + 1}`,
      title: `[DEMO] ${query} (fixture source ${i + 1})`,
      content: text,
      snippet: text.slice(0, 240),
      published_at: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
      publisher: official ? "Demo official source" : "Demo publication",
      image: null,
      provider: "demo" as const,
    };
  });
}
