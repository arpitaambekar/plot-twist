import type { SourceRecord } from "@/lib/types";
import type { ClaimDraftInput, CnfOut, FactsBoardOut, IndiaOut, PlaceDraft, PlacesOut, SnapshotOut, SynthesisOut } from "@/lib/research/schema";

/**
 * DEMO FIXTURES for the research pipeline (PLOT_TWIST_DEMO_FIXTURES=true, development only).
 * Claims quote the demo search passages verbatim so the real verification step runs end to end.
 * Everything is prefixed [DEMO] and must never be read as travel information.
 */

type Labelled = Map<string, { record: SourceRecord; text: string }>;

function claimsFrom(sources: Labelled, count: number, offset: number, label: string): ClaimDraftInput[] {
  const labels = [...sources.keys()];
  if (!labels.length) return [];
  return Array.from({ length: count }, (_, i) => {
    const l = labels[(offset + i) % labels.length];
    const text = sources.get(l)!.text;
    const quote = /Demo statement \d+ about [^.]+ offline/.exec(text)?.[0] ?? text.slice(0, 120);
    return { text: `[DEMO] ${label} ${i + 1}: placeholder fact used to test the pipeline.`, refs: [{ source: l, quote }] };
  });
}

export function demoSnapshot(s: Labelled, d: string): SnapshotOut {
  return {
    location: claimsFrom(s, 1, 0, `${d} location`)[0] ?? null,
    overview: claimsFrom(s, 1, 1, `${d} overview`)[0] ?? null,
    why_visit: claimsFrom(s, 3, 2, "Reason to visit"),
    experiences: claimsFrom(s, 3, 3, "Experience"),
    seasons: claimsFrom(s, 2, 4, "Season"),
    considerations: claimsFrom(s, 2, 5, "Consideration"),
    trip_duration: claimsFrom(s, 1, 6, "Trip duration")[0] ?? null,
    entry_requirements: claimsFrom(s, 2, 1, "Entry requirement"),
    connectivity: claimsFrom(s, 1, 2, "Connectivity"),
  };
}

export function demoIndia(s: Labelled): IndiaOut {
  return {
    documented: claimsFrom(s, 2, 0, "Documented India awareness"),
    general_popularity: claimsFrom(s, 2, 2, "General popularity"),
    entertainment_links: claimsFrom(s, 1, 3, "Entertainment link"),
    india_evidence: claimsFrom(s, 2, 4, "India demand evidence"),
    barriers: claimsFrom(s, 2, 5, "Barrier"),
    segments: ["[DEMO] Segment A", "[DEMO] Segment B"],
    hypotheses: ["[DEMO] Strategy hypothesis for testing only."],
  };
}

function place(s: Labelled, i: number, kind: string): PlaceDraft {
  return {
    name: `[DEMO] ${kind} ${i + 1}`,
    location: "Demo location",
    description: "Placeholder description generated offline for testing.",
    why_special: "Demo reason.",
    what_makes_it_different: "Demo difference.",
    activities: ["Demo activity"],
    traveller_segment: "All",
    seasonality: "Demo season",
    accessibility: "Demo access note",
    india_relevance: "Demo relevance",
    why_famous: "Demo fame",
    claims: claimsFrom(s, 1, i, `${kind} ${i + 1}`),
  };
}

export function demoPlaces(s: Labelled): PlacesOut {
  return {
    beyond: Array.from({ length: 10 }, (_, i) => place(s, i, "Under-promoted place")),
    top: Array.from({ length: 10 }, (_, i) => place(s, i + 3, "Top attraction")),
  };
}

export function demoCnf(s: Labelled): CnfOut {
  return {
    culture: [
      { heading: "Festivals", items: claimsFrom(s, 2, 0, "Festival") },
      { heading: "Heritage", items: claimsFrom(s, 2, 2, "Heritage") },
    ],
    nature: [{ heading: "Hiking", items: claimsFrom(s, 2, 4, "Hike") }],
    food: { dishes: claimsFrom(s, 3, 1, "Dish"), experiences: claimsFrom(s, 1, 3, "Food experience"), vegetarian: claimsFrom(s, 1, 5, "Vegetarian note"), notes: [] },
  };
}

export function demoFactsBoard(s: Labelled, d: string): FactsBoardOut {
  // Facts cite the demo "official" sources so the eight-verified-facts path is exercised offline.
  const official = new Map([...s].filter(([, v]) => v.record.source_type === "government"));
  return {
    facts: claimsFrom(official.size ? official : s, 9, 0, "Surprising fact"),
    board: {
      organisation: claimsFrom(s, 1, 1, `${d} tourism organisation`)[0] ?? null,
      website: null,
      positioning: claimsFrom(s, 1, 2, "Positioning"),
      recent_campaigns: claimsFrom(s, 2, 3, "Campaign"),
      india_activity: claimsFrom(s, 1, 4, "India activity"),
      priorities: claimsFrom(s, 1, 5, "Priority"),
      partnerships: [],
    },
  };
}

export function demoSynthesis(d: string): SynthesisOut {
  return {
    executive_summary: `[DEMO] Offline fixture report for ${d}. All content is placeholder data generated to test the research workflow; it is not travel information.`,
    campaign_summary: {
      opportunities: [1, 2, 3].map((i) => ({ title: `[DEMO] Opportunity ${i}`, rationale: "Placeholder rationale for testing." })),
      territories: [1, 2, 3].map((i) => ({ name: `[DEMO] Territory ${i}`, description: "Placeholder creative territory." })),
      segments: ["[DEMO] Segment A"],
      scapia_touchpoints: ["[DEMO] In-app destination page (hypothesis)"],
      constraints: ["[DEMO] Placeholder constraint"],
      next_step: "[DEMO] Configure real API keys to run genuine research.",
    },
  };
}
