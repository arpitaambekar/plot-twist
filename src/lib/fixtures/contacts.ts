import type { SearchResult } from "@/lib/search";

/**
 * DEMO FIXTURES for the contact finder. Used only when PLOT_TWIST_DEMO_FIXTURES=true in development.
 * The people below are fictional ("Demo Person") and live on the reserved .invalid domain, so the
 * verification path can be exercised offline without ever resembling a real contact.
 */
export function demoContactResults(org: string, destination: string): SearchResult[] {
  const slug = destination.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const now = Date.now();
  const mk = (host: string, n: number, text: string, official: boolean): SearchResult => ({
    url: `https://${official ? "gov." : ""}${host}/${slug}/team-${n}`,
    title: `[DEMO] ${org} team page ${n}`,
    content: text,
    snippet: text.slice(0, 240),
    published_at: new Date(now - n * 86400000 * 20).toISOString(),
    publisher: official ? "Demo official source" : "Demo trade publication",
    image: null,
    provider: "demo",
  });
  return [
    mk(
      "demo-fixture.invalid",
      1,
      `[DEMO FIXTURE] Demo Person Alpha, Demo Director India at the ${org}, leads trade and marketing partnerships for the Indian market. Contact the India office at india-office@demo-fixture.invalid.`,
      true,
    ),
    mk("demo-trade-a.invalid", 2, `[DEMO FIXTURE] Demo Person Beta, Demo Marketing Manager India for the ${org}, announced a roadshow in Mumbai.`, false),
    mk("demo-trade-b.invalid", 3, `[DEMO FIXTURE] Demo Person Beta, Demo Marketing Manager India for the ${org}, spoke at a trade event.`, false),
  ];
}

export function demoExtraction(sources: Map<string, { text: string }>, org: string, destination: string) {
  const find = (needle: string) => [...sources.entries()].filter(([, s]) => s.text.includes(needle)).map(([k]) => k);
  const alpha = find("Demo Person Alpha");
  const beta = find("Demo Person Beta");
  return {
    organisation: org,
    official_website_source: alpha[0] ?? null,
    india_office: "Demo India office (fixture)",
    representation_agency: null,
    notes: ["Demo fixture extraction: fictional people for offline testing only."],
    candidates: [
      ...(alpha.length
        ? [
            {
              full_name: "Demo Person Alpha",
              job_title: "Demo Director India",
              organisation: org,
              destination,
              responsibility: "Trade and marketing partnerships for the Indian market (demo).",
              india_relevance: "Leads the India market (demo).",
              india_office: "Demo India office",
              agency: null,
              email: "india-office@demo-fixture.invalid",
              phone: null,
              refs: alpha.map((s) => ({ source: s, quote: `Demo Person Alpha, Demo Director India at the ${org}` })),
            },
          ]
        : []),
      ...(beta.length
        ? [
            {
              full_name: "Demo Person Beta",
              job_title: "Demo Marketing Manager India",
              organisation: org,
              destination,
              responsibility: "India marketing (demo).",
              india_relevance: "India marketing manager (demo).",
              india_office: null,
              agency: null,
              email: "beta.guess@demo-fixture.invalid",
              phone: null,
              refs: beta.map((s) => ({ source: s, quote: `Demo Person Beta, Demo Marketing Manager India for the ${org}` })),
            },
          ]
        : []),
    ],
  };
}
