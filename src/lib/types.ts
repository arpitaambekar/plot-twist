/**
 * Shared data model for plot twist.
 * Every table here has a matching table in supabase/migrations (snake_case columns, jsonb for nested objects).
 */

export type Role = "admin" | "editor" | "viewer";

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: Role;
  created_at: string;
}

/* ---------------------------------------------------------------- sources & claims */

export type SourceType = "official" | "government" | "tourism_board" | "airline" | "trade" | "news" | "research" | "reference" | "other";

/** Claim-level verification status (spec section 14). */
export type ClaimStatus = "Verified" | "Corroborated" | "Needs Verification" | "Unverified";

/** Information types drive freshness policies. */
export type FreshnessClass = "visa" | "contact" | "event" | "statistic" | "connectivity" | "campaign" | "general" | "historical";

export interface SourceRecord {
  id: string;
  url: string;
  title: string;
  publisher: string;
  source_type: SourceType;
  published_at: string | null;
  retrieved_at: string;
  /** Short excerpt kept for the source drawer. Untrusted external text, display only. */
  excerpt: string;
  is_demo: boolean;
}

export interface ClaimEvidence {
  source_id: string;
  /** Verbatim supporting passage, checked against the retrieved source text. */
  quote: string;
  quote_found: boolean;
}

export interface Claim {
  id: string;
  subject_type: "report" | "news" | "contact" | "stat" | "library";
  subject_id: string;
  section: string;
  text: string;
  status: ClaimStatus;
  status_reason: string;
  evidence: ClaimEvidence[];
  reporting_period: string | null;
  freshness_class: FreshnessClass;
  verified_at: string | null;
  created_at: string;
}

export interface VerificationEvent {
  id: string;
  subject_type: "claim" | "contact";
  subject_id: string;
  status: string;
  note: string;
  actor: string;
  created_at: string;
}

/* ---------------------------------------------------------------- images */

export interface ImageRef {
  url: string;
  alt: string;
  /** e.g. "Wikimedia Commons" */
  provider: string;
  author: string | null;
  license: string | null;
  license_url: string | null;
  source_page: string | null;
  /** True when the photo is a generic destination photo rather than one from the article/item itself. */
  is_destination_photo?: boolean;
}

/* ---------------------------------------------------------------- destinations */

export interface Destination {
  id: string;
  name: string;
  slug: string;
  kind: "country" | "city" | "region" | "island" | "province" | "area";
  country: string;
  continent: string;
  tourism_board: string | null;
  board_website: string | null;
  india_page: string | null;
  /** Commons search hint for the hero photograph. */
  photo_query: string;
  photo_file: string | null;
  tagline: string | null;
  board_verified: boolean;
  created_at: string;
}

/* ---------------------------------------------------------------- news */

export type NewsCategory =
  | "Tourism-board campaign"
  | "Board business"
  | "Indian outbound"
  | "Connectivity"
  | "Visa & entry"
  | "Events & festivals"
  | "Investment & development"
  | "Industry";

export type IndiaRelevance = "High" | "Medium" | "Low";

export interface NewsArticle {
  id: string;
  url: string;
  title: string;
  summary: string;
  image: ImageRef | null;
  source_name: string;
  publisher: string;
  source_type: SourceType;
  published_at: string | null;
  retrieved_at: string;
  event_date: string | null;
  destinations: string[];
  continent: string | null;
  category: NewsCategory;
  tourism_board: string | null;
  india_relevance: IndiaRelevance;
  /** AI-written, labelled as analysis. Null when AI is not configured. */
  why_it_matters: string | null;
  take: string | null;
  dedupe_key: string;
  via: "rss" | "search" | "manual";
  is_demo: boolean;
}

export interface FeedConfig {
  id: string;
  name: string;
  url: string;
  publisher: string;
  source_type: SourceType;
  enabled: boolean;
  last_status: "ok" | "failed" | "never";
  last_checked_at: string | null;
  last_error: string | null;
  item_count: number;
}

export interface OutboundStat {
  id: string;
  metric: string;
  destination: string;
  value: number;
  unit: string;
  reporting_period: string;
  definition: string;
  geography: string;
  yoy_change_pct: number | null;
  comparison_value: number | null;
  comparison_period: string | null;
  publisher: string;
  source_title: string;
  source_url: string;
  source_type: SourceType;
  published_date: string | null;
  verified_at: string;
  notes: string;
  status: ClaimStatus;
  created_by: string;
  created_at: string;
}

export interface OpportunitySignal {
  id: string;
  destination: string;
  what_happened: string;
  evidence_news_ids: string[];
  evidence_urls: string[];
  why_it_matters: string;
  time_sensitivity: "Act now" | "This quarter" | "Watch";
  next_action: string;
  /** "Confirmed activity" = the event happened per sources; "Speculative opportunity" = our hypothesis. */
  confidence: "Confirmed activity" | "Speculative opportunity";
  created_at: string;
  is_demo: boolean;
}

/* ---------------------------------------------------------------- research */

export type JobStatus = "queued" | "finding_sources" | "extracting_facts" | "verifying" | "generating_report" | "completed" | "failed";

export interface ResearchJob {
  id: string;
  kind: "destination_report" | "contact_search" | "news_refresh" | "campaign_generation";
  status: JobStatus;
  input: Record<string, unknown>;
  result_id: string | null;
  error: string | null;
  attempts: number;
  log: { at: string; message: string }[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ReportOptions {
  traveller_type: "All" | "Couples" | "Families" | "Solo travellers" | "Friends" | "Adventure travellers" | "Luxury travellers";
  travel_period: string;
  depth: "quick" | "comprehensive";
}

/** A sourced item: anything that states facts references claim ids. */
export interface SourcedText {
  text: string;
  claim_ids: string[];
}

export interface PlaceItem {
  name: string;
  location: string;
  description: string;
  why_special?: string;
  what_makes_it_different?: string;
  activities?: string[];
  traveller_segment?: string;
  seasonality?: string;
  accessibility?: string;
  india_relevance?: string;
  why_famous?: string;
  image: ImageRef | null;
  claim_ids: string[];
}

export interface ReportContent {
  snapshot: {
    location: SourcedText;
    overview: SourcedText;
    why_visit: SourcedText[];
    experiences: SourcedText[];
    seasons: SourcedText[];
    considerations: SourcedText[];
    trip_duration: SourcedText;
    entry_requirements: SourcedText[];
    connectivity: SourcedText[];
    hero_image: ImageRef | null;
  };
  indians_know: {
    documented: SourcedText[];
    general_popularity: SourcedText[];
    entertainment_links: SourcedText[];
    awareness_note: string;
  };
  beyond_itinerary: PlaceItem[];
  culture: { heading: string; items: SourcedText[] }[];
  nature: { heading: string; items: SourcedText[] }[];
  food: { dishes: SourcedText[]; experiences: SourcedText[]; vegetarian: SourcedText[]; notes: SourcedText[] };
  top_things: PlaceItem[];
  surprising_facts: SourcedText[];
  facts_gap_note: string | null;
  india_relevance: {
    evidence: SourcedText[];
    segments: string[];
    barriers: SourcedText[];
    hypotheses: string[];
  };
  board_intel: {
    organisation: SourcedText;
    website: string | null;
    positioning: SourcedText[];
    recent_campaigns: SourcedText[];
    india_activity: SourcedText[];
    priorities: SourcedText[];
    partnerships: SourcedText[];
    note: string;
  };
  campaign_summary: {
    opportunities: { title: string; rationale: string }[];
    territories: { name: string; description: string }[];
    segments: string[];
    scapia_touchpoints: string[];
    constraints: string[];
    next_step: string;
  };
  executive_summary: string;
  gallery: ImageRef[];
}

export interface ReportHealth {
  total_claims: number;
  evidenced_claims: number;
  evidence_pct: number;
  unresolved_claims: number;
  stale_claims: number;
  source_count: number;
  official_source_count: number;
  by_status: Record<ClaimStatus, number>;
  computed_at: string;
}

export interface Report {
  id: string;
  destination_id: string | null;
  destination_name: string;
  query: string;
  options: ReportOptions;
  version: number;
  status: "generating" | "completed" | "partial" | "failed";
  content: ReportContent | null;
  source_ids: string[];
  health: ReportHealth | null;
  job_id: string | null;
  partial_notes: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
  is_demo: boolean;
}

export interface ReportVersion {
  id: string;
  report_id: string;
  version: number;
  content: ReportContent | null;
  source_ids: string[];
  health: ReportHealth | null;
  change_summary: string;
  created_at: string;
}

/* ---------------------------------------------------------------- campaigns */

export type BudgetTier = "Lean" | "Mid-scale" | "Premium" | "Hero activation";

export interface CampaignBrief {
  destination: string;
  tourism_board?: string;
  objective?: string;
  audience?: string;
  season?: string;
  budget_tier?: BudgetTier | "";
  duration?: string;
  focus_areas?: string;
  channels?: string[];
  positioning?: string;
  ambition?: "Practical" | "Bold" | "Wild but executable" | "";
  inspiration?: { reference_id: string; name: string; mechanism: string; learning: string } | null;
}

/** Editable fields of a campaign concept, in display order. */
export const CAMPAIGN_FIELDS = [
  ["name", "Campaign name"],
  ["line", "Campaign line"],
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
  ["budget_tier", "Budget tier"],
  ["success_metrics", "Success metrics"],
  ["risks", "Risks and dependencies"],
  ["channels", "Channels"],
] as const;

export type CampaignField = (typeof CAMPAIGN_FIELDS)[number][0];

export interface CampaignContent {
  name: string;
  line: string;
  campaign_type: string;
  summary: string;
  core_insight: string;
  big_idea: string;
  why_destination: string;
  target_audience: string;
  how_it_works: string;
  hero_activation: string;
  scapia_integration: string;
  deliverables: string;
  creator_opportunities: string;
  user_journey: string;
  board_value: string;
  feasibility: string;
  budget_tier: string;
  success_metrics: string;
  risks: string;
  channels: string;
  /** Labels such as "Requires product development", "Requires external partner". */
  dependency_flags: string[];
  /** Claim ids from the linked report version that informed the idea. */
  research_claim_ids: string[];
  research_notes: string;
}

export type IdeaStatus = "draft" | "shortlisted" | "rejected" | "approved";

export interface CampaignIdea {
  id: string;
  set_id: string;
  report_id: string | null;
  report_version: number | null;
  destination: string;
  content: CampaignContent;
  status: IdeaStatus;
  /** Fields a human edited. AI refinement never overwrites them without explicit consent. */
  locked_fields: string[];
  origin: "generated" | "duplicated" | "combined" | "regenerated";
  parent_ids: string[];
  merge_notes: string | null;
  reviewer: string | null;
  approval_note: string | null;
  image: ImageRef | null;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_demo: boolean;
}

export interface CampaignRevision {
  id: string;
  idea_id: string;
  version: number;
  content: CampaignContent;
  locked_fields: string[];
  action: string;
  author: string;
  created_at: string;
}

export interface CampaignComment {
  id: string;
  idea_id: string;
  kind: "comment" | "note";
  body: string;
  author: string;
  created_at: string;
}

export interface CampaignExtras {
  in_app: {
    placement: string;
    audience: string;
    hook: string;
    interaction: string;
    message: string;
    experience: string;
    next_action: string;
    measurement: string;
  }[];
  short_form: {
    title: string;
    hook: string;
    format: string;
    structure: string;
    episodes: string[];
    visual_direction: string;
    creators: string;
    cta: string;
    why_destination: string;
  }[];
  long_form: {
    name: string;
    storyline: string;
    episodes: string;
    duration: string;
    host_format: string;
    locations: string;
    journey: string;
    brand_integration: string;
    distribution: string;
    planning_connection: string;
  }[];
  hero_ideas: {
    concept: string;
    mechanism: string;
    participation: string;
    production: string;
    partners: string;
    feasibility: string;
    risks: string;
    budget_complexity: string;
    scapia_connection: string;
    digital_only: boolean;
  }[];
}

export interface CampaignSet {
  id: string;
  title: string;
  destination: string;
  report_id: string | null;
  report_version: number | null;
  input_mode: "report" | "upload" | "paste" | "destination";
  /** Research text supplied via upload/paste (untrusted, sanitised). */
  supplied_research: string | null;
  supplied_filename: string | null;
  brief: CampaignBrief;
  extras: CampaignExtras | null;
  status: "generating" | "ready" | "failed";
  error: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_demo: boolean;
}

export interface Comparison {
  id: string;
  idea_ids: string[];
  criteria: string[];
  scores: { idea_id: string; scores: Record<string, { score: number; rationale: string }>; summary: string }[];
  verdict: string;
  created_by: string;
  created_at: string;
}

export const PITCH_SECTIONS = [
  ["destination_opportunity", "Destination opportunity"],
  ["marketing_objective", "Marketing objective"],
  ["traveller_insight", "Indian traveller insight"],
  ["positioning", "Campaign positioning"],
  ["big_idea", "Big idea"],
  ["narrative", "Campaign narrative"],
  ["hero_activation", "Hero activation"],
  ["in_app", "In-app marketing"],
  ["creator_strategy", "Creator strategy"],
  ["social_formats", "Social content formats"],
  ["long_form", "Long-form storytelling"],
  ["participation", "Participation mechanics"],
  ["user_journey", "User journey"],
  ["channel_plan", "Channel plan"],
  ["deliverables", "Deliverables"],
  ["timeline", "Suggested timeline"],
  ["measurement", "Measurement"],
  ["feasibility", "Feasibility"],
  ["dependencies", "Dependencies"],
  ["supporting_research", "Supporting research and sources"],
] as const;

export type PitchSectionKey = (typeof PITCH_SECTIONS)[number][0];

export interface Pitch {
  id: string;
  idea_id: string;
  title: string;
  destination: string;
  sections: Record<PitchSectionKey, string>;
  source_ids: string[];
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_demo: boolean;
}

/* ---------------------------------------------------------------- library */

export interface ReferenceCampaign {
  id: string;
  name: string;
  tourism_board: string;
  destination: string;
  launch_date: string | null;
  objective: string;
  insight: string;
  creative_idea: string;
  execution: string;
  participation_mechanism: string;
  channels: string[];
  target_audience: string;
  campaign_types: string[];
  official_link: string | null;
  sources: { title: string; url: string; publisher: string; published: string | null }[];
  published_results: string | null;
  strategic_learning: string;
  scapia_relevance: string;
  verification: ClaimStatus;
  verified_at: string;
  image: ImageRef | null;
  created_at: string;
}

/* ---------------------------------------------------------------- contacts */

export type ContactStatus = "Officially Verified" | "Cross-Verified" | "Needs Verification" | "Not Found";

export interface ContactSource {
  url: string;
  title: string;
  publisher: string;
  is_official: boolean;
  quote: string;
  retrieved_at: string;
}

export interface Contact {
  id: string;
  full_name: string;
  job_title: string;
  organisation: string;
  destination: string;
  responsibility: string;
  india_relevance: string;
  india_office: string | null;
  agency: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  linkedin: string | null;
  sources: ContactSource[];
  status: ContactStatus;
  verification_reason: string;
  last_verified_at: string;
  notes: string;
  query: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_demo: boolean;
}

export interface ContactSearch {
  id: string;
  query: string;
  status: "running" | "completed" | "failed";
  contact_ids: string[];
  organisation: string | null;
  notes: string[];
  error: string | null;
  created_by: string;
  created_at: string;
}

/* ---------------------------------------------------------------- opportunities */

export const STAGES = [
  "Identified",
  "Researching",
  "Contact Found",
  "Outreach Sent",
  "Meeting Scheduled",
  "Proposal in Progress",
  "Proposal Submitted",
  "Negotiation",
  "Won",
  "Lost",
  "On Hold",
] as const;
export type Stage = (typeof STAGES)[number];

export type Priority = "High" | "Medium" | "Low";

/** Manually assessed readiness criteria: true / false / null (= Not assessed). */
export type ManualCheck = boolean | null;

export interface Opportunity {
  id: string;
  name: string;
  destination: string;
  tourism_board: string | null;
  summary: string;
  stage: Stage;
  priority: Priority;
  owner: string | null;
  next_action: string | null;
  next_action_date: string | null;
  last_interaction: string | null;
  campaign_window: string | null;
  commercial_notes: string | null;
  notes: string;
  news_ids: string[];
  report_id: string | null;
  idea_ids: string[];
  shortlisted_idea_id: string | null;
  pitch_id: string | null;
  contact_ids: string[];
  source_links: { title: string; url: string }[];
  manual_checks: Record<string, ManualCheck>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OpportunityActivity {
  id: string;
  opportunity_id: string;
  kind: "note" | "stage_change" | "link" | "outreach_recorded" | "meeting_recorded" | "created" | "update";
  body: string;
  author: string;
  created_at: string;
}

/* ---------------------------------------------------------------- user data */

export type SavedType = "news" | "report" | "idea" | "contact" | "reference" | "pitch" | "opportunity";

export interface SavedItem {
  id: string;
  user_id: string;
  item_type: SavedType;
  item_id: string;
  label: string;
  created_at: string;
}

export interface WatchItem {
  id: string;
  user_id: string;
  kind: "destination" | "tourism_board" | "category" | "india_market";
  value: string;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface UsageEvent {
  id: string;
  user_id: string;
  kind: "ai" | "search" | "research" | "contact_search" | "news_refresh" | "export";
  units: number;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface AppSettings {
  id: string;
  news_refresh_hours: number;
  news_lookback_days: number;
  default_research_depth: "quick" | "comprehensive";
  report_cache_days: number;
  daily_research_limit: number;
  daily_ai_limit: number;
  preferred_domains: string[];
  blocked_domains: string[];
  ai_model: string | null;
  scoring_weights: Record<string, number>;
  last_news_refresh_at: string | null;
  updated_at: string;
}

export interface TableMap {
  profiles: Profile;
  destinations: Destination;
  sources: SourceRecord;
  claims: Claim;
  verification_events: VerificationEvent;
  news_articles: NewsArticle;
  feeds: FeedConfig;
  outbound_stats: OutboundStat;
  opportunity_signals: OpportunitySignal;
  research_jobs: ResearchJob;
  reports: Report;
  report_versions: ReportVersion;
  campaign_sets: CampaignSet;
  campaign_ideas: CampaignIdea;
  campaign_revisions: CampaignRevision;
  campaign_comments: CampaignComment;
  comparisons: Comparison;
  pitches: Pitch;
  reference_campaigns: ReferenceCampaign;
  contacts: Contact;
  contact_searches: ContactSearch;
  opportunities: Opportunity;
  opportunity_activities: OpportunityActivity;
  saved_items: SavedItem;
  watchlist: WatchItem;
  audit_log: AuditEntry;
  usage_events: UsageEvent;
  app_settings: AppSettings;
}

export type TableName = keyof TableMap;
