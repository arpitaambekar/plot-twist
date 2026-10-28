import "server-only";
import { db, newId, nowIso } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import type { UsageEvent } from "@/lib/types";

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

const buckets = new Map<string, { tokens: number; at: number }>();

/** In-process token bucket for burst protection (per user and action). */
export function burstLimit(key: string, capacity = 10, refillPerMinute = 10) {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: capacity, at: now };
  b.tokens = Math.min(capacity, b.tokens + ((now - b.at) / 60000) * refillPerMinute);
  b.at = now;
  if (b.tokens < 1) throw new RateLimitError("You're going a little fast. Please wait a moment and try again.");
  b.tokens -= 1;
  buckets.set(key, b);
}

/** Daily usage limits, configurable in Admin. */
export async function checkDailyLimit(userId: string, kind: UsageEvent["kind"]) {
  const settings = await getSettings();
  const limit = kind === "research" || kind === "contact_search" ? settings.daily_research_limit : kind === "ai" ? settings.daily_ai_limit : 0;
  if (!limit) return;
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const events = await db().list("usage_events", { where: { user_id: userId, kind } as never, orderBy: { column: "created_at" }, limit: 500 });
  const used = events.filter((e) => e.created_at >= since).reduce((n, e) => n + e.units, 0);
  if (used >= limit) throw new RateLimitError(`Daily ${kind.replace("_", " ")} limit reached (${limit}). An admin can change this in Admin → Usage.`);
}

export async function recordUsage(userId: string, kind: UsageEvent["kind"], units = 1, meta: Record<string, unknown> = {}) {
  await db().insert("usage_events", { id: newId(), user_id: userId, kind, units, meta, created_at: nowIso() });
}
