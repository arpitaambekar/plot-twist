import "server-only";
import { db, nowIso } from "@/lib/db";
import type { AppSettings } from "@/lib/types";

export const DEFAULT_SETTINGS: AppSettings = {
  id: "global",
  news_refresh_hours: 8,
  news_lookback_days: 30,
  default_research_depth: "comprehensive",
  report_cache_days: 14,
  daily_research_limit: 25,
  daily_ai_limit: 300,
  preferred_domains: [],
  blocked_domains: [],
  ai_model: null,
  scoring_weights: { india_activity: 3, timing: 2, contact: 2, research: 2, campaign: 1 },
  last_news_refresh_at: null,
  updated_at: nowIso(),
};

export async function getSettings(): Promise<AppSettings> {
  const row = await db().get("app_settings", "global");
  return { ...DEFAULT_SETTINGS, ...(row ?? {}) };
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const next = { ...current, ...patch, id: "global", updated_at: nowIso() };
  await db().upsert("app_settings", next);
  return next;
}
