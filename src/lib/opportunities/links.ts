import { z } from "zod";

/** Links that can be attached to an opportunity from anywhere in the app. */
export const OpportunityLinks = z.object({
  news_ids: z.array(z.string()).optional(),
  report_id: z.string().nullable().optional(),
  idea_ids: z.array(z.string()).optional(),
  shortlisted_idea_id: z.string().nullable().optional(),
  pitch_id: z.string().nullable().optional(),
  contact_ids: z.array(z.string()).optional(),
  source_links: z.array(z.object({ title: z.string().max(300), url: z.string().url() })).optional(),
});
export type OpportunityLinksInput = z.infer<typeof OpportunityLinks>;
