import { z } from "zod";

export const FeedInput = z.object({
  name: z.string().trim().min(2).max(120),
  url: z.string().url().max(500),
  publisher: z.string().trim().min(1).max(200),
  source_type: z.enum(["official", "government", "tourism_board", "airline", "trade", "news", "research", "reference", "other"]),
  enabled: z.boolean().default(true),
});
