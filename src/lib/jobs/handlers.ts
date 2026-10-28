import "server-only";
import type { ResearchJob } from "@/lib/types";
import { runResearchJob } from "@/lib/research/pipeline";
import { runContactJob } from "@/lib/contacts/discover";
import { runNewsJob } from "@/lib/news/ingest";
import { runCampaignJob } from "@/lib/campaigns/generate";

export const handlers: Record<ResearchJob["kind"], (job: ResearchJob) => Promise<void>> = {
  destination_report: runResearchJob,
  contact_search: runContactJob,
  news_refresh: runNewsJob,
  campaign_generation: runCampaignJob,
};
