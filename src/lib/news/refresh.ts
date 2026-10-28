import "server-only";
import { db } from "@/lib/db";
import { createJob, runInBackground } from "@/lib/jobs";
import { getSettings } from "@/lib/settings";
import type { ResearchJob } from "@/lib/types";

/** Returns the running refresh job if one is in flight (avoids duplicate, costly sweeps). */
export async function activeNewsJob(): Promise<ResearchJob | null> {
  const jobs = await db().list("research_jobs", { where: { kind: "news_refresh" } as never, orderBy: { column: "created_at" }, limit: 5 });
  const cutoff = Date.now() - 15 * 60 * 1000;
  return jobs.find((j) => !["completed", "failed"].includes(j.status) && new Date(j.updated_at).getTime() > cutoff) ?? null;
}

export async function startNewsRefresh(userId: string): Promise<ResearchJob> {
  const running = await activeNewsJob();
  if (running) return running;
  const job = await createJob("news_refresh", {}, userId);
  runInBackground(job.id);
  return job;
}

/** Is the cached news older than the configured refresh interval? */
export async function newsIsStale(): Promise<boolean> {
  const s = await getSettings();
  if (!s.last_news_refresh_at) return true;
  return Date.now() - new Date(s.last_news_refresh_at).getTime() > s.news_refresh_hours * 3600 * 1000;
}

export async function lastNewsJob(): Promise<ResearchJob | null> {
  const jobs = await db().list("research_jobs", { where: { kind: "news_refresh" } as never, orderBy: { column: "created_at" }, limit: 1 });
  return jobs[0] ?? null;
}
