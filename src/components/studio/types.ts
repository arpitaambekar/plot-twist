import type { CampaignIdea, CampaignSet, Claim, CampaignComment, CampaignRevision, SourceRecord, ResearchJob } from "@/lib/types";

export interface WorkspaceData {
  set: CampaignSet;
  ideas: CampaignIdea[];
  job: (ResearchJob & { label: string }) | null;
  report: { id: string; destination_name: string; version: number; status: string } | null;
  pitches: { id: string; idea_id: string; title: string; updated_at: string }[];
  saved_ids: string[];
}

export interface IdeaDetail {
  idea: CampaignIdea;
  set: { id: string; title: string; destination: string; input_mode: CampaignSet["input_mode"]; supplied_filename: string | null; brief: CampaignSet["brief"] };
  revisions: CampaignRevision[];
  comments: CampaignComment[];
  research: { claims: Claim[]; sources: SourceRecord[] };
  report: { id: string; destination_name: string; version: number } | null;
  pitches: { id: string; title: string; updated_at: string }[];
  parents: { id: string; name: string }[];
}

export const FIELD_ORDER: [string, string, string?][] = [
  ["summary", "Summary"],
  ["campaign_type", "Campaign type"],
  ["core_insight", "Core insight"],
  ["big_idea", "The big idea"],
  ["why_destination", "Why this destination?"],
  ["target_audience", "Target audience"],
  ["how_it_works", "How it works"],
  ["hero_activation", "Hero activation"],
  ["scapia_integration", "Scapia integration"],
  ["deliverables", "Campaign deliverables"],
  ["creator_opportunities", "Creator opportunities"],
  ["user_journey", "User journey"],
  ["board_value", "Tourism board value"],
  ["feasibility", "Feasibility"],
  ["budget_tier", "Budget tier", "Relative production complexity, not a quote"],
  ["success_metrics", "Success metrics"],
  ["risks", "Risks and dependencies"],
  ["channels", "Channels"],
  ["research_notes", "Research behind the idea"],
];

export function feasibilityTone(f: string): "mint" | "peach" | "danger" | "neutral" {
  const t = f.trim().toLowerCase();
  if (t.startsWith("high")) return "mint";
  if (t.startsWith("medium")) return "peach";
  if (t.startsWith("low")) return "danger";
  return "neutral";
}

export function feasibilityLabel(f: string) {
  const m = /^(high|medium|low)/i.exec(f.trim());
  return m ? `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()} feasibility` : "Feasibility";
}
