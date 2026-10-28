import { z } from "zod";

/** AI-facing schemas for Campaign Studio. All outputs are validated before anything is stored. */

export const AiIdea = z.object({
  name: z.string().min(2),
  line: z.string().min(2),
  campaign_type: z.string().min(2),
  summary: z.string().min(10),
  core_insight: z.string(),
  big_idea: z.string(),
  why_destination: z.string(),
  target_audience: z.string(),
  how_it_works: z.string(),
  hero_activation: z.string(),
  scapia_integration: z.string(),
  deliverables: z.string(),
  creator_opportunities: z.string(),
  user_journey: z.string(),
  board_value: z.string(),
  feasibility: z.string(),
  budget_tier: z.string(),
  success_metrics: z.string(),
  risks: z.string(),
  channels: z.string(),
  dependency_flags: z.array(z.string()).default([]),
  /** Fact labels (F1, F2…) from the research context that informed the idea. */
  research_refs: z.array(z.string()).default([]),
  research_notes: z.string().default(""),
  /** A specific place/scene to illustrate the card with a licensed photo. */
  photo_subject: z.string().default(""),
});
export type AiIdea = z.infer<typeof AiIdea>;

export const IdeaBatch = z.object({ ideas: z.array(AiIdea).min(1) });

export const Extras = z.object({
  in_app: z
    .array(
      z.object({
        placement: z.string(),
        audience: z.string(),
        hook: z.string(),
        interaction: z.string(),
        message: z.string(),
        experience: z.string(),
        next_action: z.string(),
        measurement: z.string(),
      }),
    )
    .min(8)
    .max(10),
  short_form: z
    .array(
      z.object({
        title: z.string(),
        hook: z.string(),
        format: z.string(),
        structure: z.string(),
        episodes: z.array(z.string()).min(3).max(3),
        visual_direction: z.string(),
        creators: z.string(),
        cta: z.string(),
        why_destination: z.string(),
      }),
    )
    .length(5),
  long_form: z
    .array(
      z.object({
        name: z.string(),
        storyline: z.string(),
        episodes: z.string(),
        duration: z.string(),
        host_format: z.string(),
        locations: z.string(),
        journey: z.string(),
        brand_integration: z.string(),
        distribution: z.string(),
        planning_connection: z.string(),
      }),
    )
    .length(3),
  hero_ideas: z
    .array(
      z.object({
        concept: z.string(),
        mechanism: z.string(),
        participation: z.string(),
        production: z.string(),
        partners: z.string(),
        feasibility: z.string(),
        risks: z.string(),
        budget_complexity: z.string(),
        scapia_connection: z.string(),
        digital_only: z.boolean(),
      }),
    )
    .length(3),
});

export const RefineOutput = z.object({
  changes: z.array(z.object({ field: z.string(), value: z.string(), reason: z.string().default("") })),
  note: z.string().default(""),
});

export const CompareOutput = z.object({
  ideas: z.array(
    z.object({
      ref: z.string(),
      scores: z.array(z.object({ criterion: z.string(), score: z.number().min(1).max(5), rationale: z.string() })),
      summary: z.string(),
    }),
  ),
  verdict: z.string(),
});

export const CombineOutput = z.object({
  idea: AiIdea,
  merge: z.object({
    retained: z.string(),
    removed: z.string(),
    how_merged: z.string(),
    why_stronger: z.string(),
    feasibility: z.string(),
  }),
});

export const PitchOutput = z.object({
  title: z.string(),
  sections: z.object({
    destination_opportunity: z.string(),
    marketing_objective: z.string(),
    traveller_insight: z.string(),
    positioning: z.string(),
    big_idea: z.string(),
    narrative: z.string(),
    hero_activation: z.string(),
    in_app: z.string(),
    creator_strategy: z.string(),
    social_formats: z.string(),
    long_form: z.string(),
    participation: z.string(),
    user_journey: z.string(),
    channel_plan: z.string(),
    deliverables: z.string(),
    timeline: z.string(),
    measurement: z.string(),
    feasibility: z.string(),
    dependencies: z.string(),
  }),
});

/** Comparison criteria (spec §9). */
export const COMPARE_CRITERIA = [
  "Originality",
  "Destination fit",
  "Audience relevance",
  "Strategic strength",
  "Scapia fit",
  "Feasibility",
  "Production complexity",
  "PR potential",
  "Conversion opportunity",
] as const;

/** Titles the spec explicitly bans; also used to reject lazy output. */
export const BANNED_TITLES = ["discover the magic", "explore like never before", "hidden gems await", "a journey of a lifetime", "something for everyone"];

export const OBJECTIVES = [
  "Increase destination awareness",
  "Increase Indian visitors",
  "Promote secondary destinations",
  "Encourage longer stays",
  "Promote shoulder-season travel",
  "Improve destination consideration",
  "Encourage trip planning",
  "Generate travel searches",
  "Support bookings",
  "Promote culture, food or adventure",
];

export const BUDGET_TIERS = ["Lean", "Mid-scale", "Premium", "Hero activation"] as const;
export const AMBITIONS = ["Practical", "Bold", "Wild but executable"] as const;
export const CHANNEL_OPTIONS = ["In-app", "Push & email", "Instagram Reels", "YouTube Shorts", "Long-form YouTube", "Creators", "Paid social", "PR", "Experiential", "Interactive / gamified"];

/**
 * Scapia capability library (spec §7). These are potential campaign components,
 * not claims about features that exist today.
 */
export const CAPABILITY_LIBRARY = `Potential Scapia marketing components (treat as options to consider, NOT as confirmed existing product features):
- In-app marketing: home-page banners, destination carousels, destination landing pages, sponsored destination listings, relevant flight discovery, relevant stay discovery, experience discovery, push notifications, email campaigns, deep-linked campaign pages.
- Digital and social: Instagram Reels, YouTube Shorts, long-form YouTube, creator partnerships, paid social, UGC formats, influencer challenges, PR launch films, destination video series.
- Interactive: quizzes, puzzles, personality tests, contests, digital passports, interactive itineraries, shareable results, voting challenges, creator-led audience participation, gamified discovery.
Any idea that would need new product development, an external partner or a new integration must say so in dependency_flags using these labels where relevant: "Requires product development", "Requires external partner", "Requires new integration", "Requires tourism-board approval", "Requires permits".`;

/** generateStructured infers the schema's input type; this narrows it to the parsed output (defaults applied). */
export function outputOf<S extends z.ZodTypeAny>(schema: S) {
  return schema as unknown as z.ZodType<z.output<S>>;
}
