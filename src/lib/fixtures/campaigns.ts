/**
 * DEMO FIXTURES for Campaign Studio. Used only when PLOT_TWIST_DEMO_FIXTURES=true in development,
 * so the full studio workflow can be exercised offline. Every output is labelled [DEMO] and is
 * not real creative work.
 */
import type { AiIdea } from "@/lib/campaigns/schemas";
import { COMPARE_CRITERIA } from "@/lib/campaigns/schemas";

const TYPES = [
  "Gamified discovery",
  "Creator participation",
  "Regional dispersal",
  "Shoulder-season push",
  "Personality-led quiz",
  "Long-form storytelling",
  "In-app conversion journey",
  "Cultural marketing",
  "PR hero moment",
  "Travel-planning challenge",
];

export function demoIdeaBatch(destination: string, batch: number, factLabels: string[]): { ideas: AiIdea[] } {
  return {
    ideas: Array.from({ length: 5 }, (_, i) => {
      const n = batch * 5 + i + 1;
      const type = TYPES[(n - 1) % TYPES.length];
      const refs = factLabels.length ? [factLabels[(n - 1) % factLabels.length], factLabels[n % factLabels.length]] : [];
      return {
        name: `[DEMO] ${destination} Concept ${n}`,
        line: `[DEMO] Placeholder line ${n} for ${destination}.`,
        campaign_type: type,
        summary: `[DEMO] Offline fixture concept ${n} (${type.toLowerCase()}) used to test the studio workflow. Not real creative work.`,
        core_insight: `[DEMO] Placeholder insight ${n}.`,
        big_idea: `[DEMO] Placeholder big idea ${n} for ${destination}.`,
        why_destination: `[DEMO] Placeholder destination rationale ${n}.`,
        target_audience: "[DEMO] Placeholder audience.",
        how_it_works: `[DEMO] Step 1: placeholder. Step 2: placeholder. Step 3: placeholder.`,
        hero_activation: `[DEMO] Placeholder hero activation ${n}.`,
        scapia_integration: "[DEMO] Placeholder integration (destination landing page, push notification).",
        deliverables: "[DEMO] Placeholder deliverables.",
        creator_opportunities: "[DEMO] Placeholder creator role.",
        user_journey: "[DEMO] See → explore → save → plan.",
        board_value: "[DEMO] Placeholder board value.",
        feasibility: n % 3 === 0 ? "Medium: placeholder" : "High: placeholder",
        budget_tier: ["Lean", "Mid-scale", "Premium", "Hero activation"][n % 4],
        success_metrics: "[DEMO] Placeholder KPIs.",
        risks: "[DEMO] Placeholder risks.",
        channels: n % 2 ? "In-app, Instagram Reels, Creators" : "YouTube Shorts, Push & email, PR",
        dependency_flags: n % 4 === 0 ? ["Requires product development"] : [],
        research_refs: refs,
        research_notes: "[DEMO] Fixture references the first available facts.",
        photo_subject: destination,
      };
    }),
  };
}

export function demoExtras(destination: string) {
  return {
    in_app: Array.from({ length: 8 }, (_, i) => ({
      placement: ["Home banner", "Destination carousel", "Landing page", "Push notification", "Email", "Flight results", "Stay discovery", "Experience discovery"][i],
      audience: "[DEMO] Placeholder audience",
      hook: `[DEMO] In-app hook ${i + 1} for ${destination}`,
      interaction: "[DEMO] Tap to explore",
      message: "[DEMO] Placeholder message",
      experience: "[DEMO] Placeholder experience",
      next_action: "[DEMO] Save itinerary",
      measurement: "[DEMO] CTR, saves",
    })),
    short_form: Array.from({ length: 5 }, (_, i) => ({
      title: `[DEMO] Series ${i + 1}`,
      hook: "[DEMO] Placeholder hook",
      format: "[DEMO] 30s vertical",
      structure: "[DEMO] Hook, reveal, CTA",
      episodes: ["[DEMO] Episode 1", "[DEMO] Episode 2", "[DEMO] Episode 3"],
      visual_direction: "[DEMO] Placeholder",
      creators: "[DEMO] Placeholder",
      cta: "[DEMO] Placeholder CTA",
      why_destination: "[DEMO] Placeholder",
    })),
    long_form: Array.from({ length: 3 }, (_, i) => ({
      name: `[DEMO] Long-form ${i + 1}`,
      storyline: "[DEMO] Placeholder storyline",
      episodes: "4",
      duration: "12 minutes",
      host_format: "[DEMO] Placeholder",
      locations: "[DEMO] Placeholder",
      journey: "[DEMO] Placeholder",
      brand_integration: "[DEMO] Placeholder",
      distribution: "[DEMO] Placeholder",
      planning_connection: "[DEMO] Placeholder",
    })),
    hero_ideas: Array.from({ length: 3 }, (_, i) => ({
      concept: `[DEMO] Hero idea ${i + 1}`,
      mechanism: "[DEMO] Placeholder",
      participation: "[DEMO] Placeholder",
      production: "[DEMO] Placeholder",
      partners: "[DEMO] Placeholder",
      feasibility: "[DEMO] Placeholder",
      risks: "[DEMO] Placeholder",
      budget_complexity: "[DEMO] Placeholder",
      scapia_connection: "[DEMO] Placeholder",
      digital_only: i === 0,
    })),
  };
}

export function demoRefine(fields: string[], action: string) {
  return {
    changes: fields.map((f) => ({ field: f, value: `[DEMO] Refined ${f.replace(/_/g, " ")} (${action}).`, reason: "[DEMO] Fixture refinement." })),
    note: `[DEMO] Fixture refinement for "${action}".`,
  };
}

export function demoCompare(refs: string[]) {
  return {
    ideas: refs.map((ref, i) => ({
      ref,
      scores: COMPARE_CRITERIA.map((c, j) => ({ criterion: c, score: ((i + j) % 5) + 1, rationale: `[DEMO] Placeholder rationale for ${c.toLowerCase()}.` })),
      summary: `[DEMO] Placeholder summary for ${ref}.`,
    })),
    verdict: "[DEMO] Placeholder verdict. Fixture scores are not an assessment.",
  };
}

export function demoCombine(a: AiIdea | Record<string, unknown>, b: AiIdea | Record<string, unknown>, destination: string) {
  const base = demoIdeaBatch(destination, 0, []).ideas[0];
  return {
    idea: { ...base, name: `[DEMO] Combined: ${String(a.name).replace("[DEMO] ", "")} × ${String(b.name).replace("[DEMO] ", "")}`, summary: "[DEMO] Fixture combination of two concepts." },
    merge: {
      retained: "[DEMO] Placeholder: what was kept",
      removed: "[DEMO] Placeholder: what was dropped",
      how_merged: "[DEMO] Placeholder: how they were merged",
      why_stronger: "[DEMO] Placeholder: why it is stronger",
      feasibility: "[DEMO] Placeholder: feasibility implications",
    },
  };
}

export function demoPitch(name: string) {
  const keys = [
    "destination_opportunity",
    "marketing_objective",
    "traveller_insight",
    "positioning",
    "big_idea",
    "narrative",
    "hero_activation",
    "in_app",
    "creator_strategy",
    "social_formats",
    "long_form",
    "participation",
    "user_journey",
    "channel_plan",
    "deliverables",
    "timeline",
    "measurement",
    "feasibility",
    "dependencies",
  ] as const;
  return {
    title: `[DEMO] Pitch: ${name}`,
    sections: Object.fromEntries(keys.map((k) => [k, `[DEMO] Placeholder ${k.replace(/_/g, " ")} section.`])) as Record<(typeof keys)[number], string>,
  };
}
