import { z } from "zod";

const types = ["Interactive", "Gamified", "Creator-led", "PR", "Social-first", "Digital", "Film", "Cultural", "Seasonal", "Regional dispersal", "Conversion-led"] as const;

export const ReferenceInput = z.object({
  name: z.string().min(2).max(200),
  tourism_board: z.string().min(2).max(200),
  destination: z.string().min(2).max(120),
  launch_date: z.string().max(20).nullable().optional(),
  objective: z.string().max(1500).default(""),
  insight: z.string().max(1500).default(""),
  creative_idea: z.string().max(2000).default(""),
  execution: z.string().max(3000).default(""),
  participation_mechanism: z.string().max(1500).default(""),
  channels: z.array(z.string().max(80)).max(20).default([]),
  target_audience: z.string().max(800).default(""),
  campaign_types: z.array(z.enum(types)).max(11).default([]),
  official_link: z.string().url().nullable().optional(),
  sources: z
    .array(z.object({ title: z.string().min(1).max(300), url: z.string().url(), publisher: z.string().max(200).default(""), published: z.string().max(20).nullable().default(null) }))
    .min(1, "At least one source URL is required"),
  published_results: z.string().max(1500).nullable().optional(),
  strategic_learning: z.string().max(2000).default(""),
  scapia_relevance: z.string().max(2000).default(""),
});
