import { z } from "zod";

/**
 * Extraction contracts. The model may only cite numbered sources it was given (S1..Sn)
 * and must quote supporting passages verbatim. Verification status is computed later
 * from the quotes (lib/evidence.ts), never taken from the model.
 */

export const RefSchema = z.object({
  source: z.string().regex(/^S\d+$/, "must be a source label like S3"),
  quote: z.string().min(1).max(600),
});

export const ClaimDraftSchema = z.object({
  text: z.string().min(3).max(700),
  refs: z.array(RefSchema).max(4).default([]),
  reporting_period: z.string().max(80).nullable().optional(),
});
export type ClaimDraftInput = z.infer<typeof ClaimDraftSchema>;

const Claims = z.array(ClaimDraftSchema).max(16).default([]);
const OptClaim = ClaimDraftSchema.nullable().default(null);

export const SnapshotExtraction = z.object({
  location: OptClaim,
  overview: OptClaim,
  why_visit: Claims,
  experiences: Claims,
  seasons: Claims,
  considerations: Claims,
  trip_duration: OptClaim,
  entry_requirements: Claims,
  connectivity: Claims,
});

export const IndiaExtraction = z.object({
  documented: Claims,
  general_popularity: Claims,
  entertainment_links: Claims,
  india_evidence: Claims,
  barriers: Claims,
  segments: z.array(z.string().max(160)).max(8).default([]),
  hypotheses: z.array(z.string().max(400)).max(8).default([]),
});

export const PlaceDraftSchema = z.object({
  name: z.string().min(1).max(160),
  location: z.string().max(200).default(""),
  description: z.string().max(700).default(""),
  why_special: z.string().max(500).optional(),
  what_makes_it_different: z.string().max(500).optional(),
  activities: z.array(z.string().max(120)).max(8).optional(),
  traveller_segment: z.string().max(200).optional(),
  seasonality: z.string().max(300).optional(),
  accessibility: z.string().max(400).optional(),
  india_relevance: z.string().max(400).optional(),
  why_famous: z.string().max(500).optional(),
  claims: z.array(ClaimDraftSchema).max(5).default([]),
});
export type PlaceDraft = z.infer<typeof PlaceDraftSchema>;

export const PlacesExtraction = z.object({
  beyond: z.array(PlaceDraftSchema).max(16).default([]),
  top: z.array(PlaceDraftSchema).max(16).default([]),
});

const Themed = z.array(z.object({ heading: z.string().max(80), items: Claims })).max(10).default([]);

export const CultureNatureFoodExtraction = z.object({
  culture: Themed,
  nature: Themed,
  food: z
    .object({ dishes: Claims, experiences: Claims, vegetarian: Claims, notes: Claims })
    .default({ dishes: [], experiences: [], vegetarian: [], notes: [] }),
});

export const FactsBoardExtraction = z.object({
  facts: z.array(ClaimDraftSchema).max(14).default([]),
  board: z
    .object({
      organisation: OptClaim,
      website: z.string().max(300).nullable().default(null),
      positioning: Claims,
      recent_campaigns: Claims,
      india_activity: Claims,
      priorities: Claims,
      partnerships: Claims,
    })
    .default({ organisation: null, website: null, positioning: [], recent_campaigns: [], india_activity: [], priorities: [], partnerships: [] }),
});

/** Strategic synthesis: interpretation and recommendations only, no new facts. */
export const SynthesisSchema = z.object({
  executive_summary: z.string().min(20).max(2000),
  campaign_summary: z.object({
    opportunities: z.array(z.object({ title: z.string().max(160), rationale: z.string().max(700) })).max(3),
    territories: z.array(z.object({ name: z.string().max(120), description: z.string().max(600) })).max(3),
    segments: z.array(z.string().max(200)).max(6),
    scapia_touchpoints: z.array(z.string().max(300)).max(8),
    constraints: z.array(z.string().max(300)).max(8),
    next_step: z.string().max(400),
  }),
});

export type SnapshotOut = z.infer<typeof SnapshotExtraction>;
export type IndiaOut = z.infer<typeof IndiaExtraction>;
export type PlacesOut = z.infer<typeof PlacesExtraction>;
export type CnfOut = z.infer<typeof CultureNatureFoodExtraction>;
export type FactsBoardOut = z.infer<typeof FactsBoardExtraction>;
export type SynthesisOut = z.infer<typeof SynthesisSchema>;
