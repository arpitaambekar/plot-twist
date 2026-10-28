import "server-only";
import { after } from "next/server";
import { db, newId, nowIso } from "@/lib/db";
import type { JobStatus, ResearchJob } from "@/lib/types";

export const JOB_LABEL: Record<JobStatus, string> = {
  queued: "Job created",
  finding_sources: "Finding sources",
  extracting_facts: "Extracting facts",
  verifying: "Verifying",
  generating_report: "Generating report",
  completed: "Completed",
  failed: "Failed",
};

export async function createJob(kind: ResearchJob["kind"], input: Record<string, unknown>, userId: string): Promise<ResearchJob> {
  const job: ResearchJob = {
    id: newId("job_"),
    kind,
    status: "queued",
    input,
    result_id: null,
    error: null,
    attempts: 0,
    log: [{ at: nowIso(), message: "Job created" }],
    created_by: userId,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  return db().insert("research_jobs", job);
}

export async function setJobStage(jobId: string, status: JobStatus, message?: string, patch: Partial<ResearchJob> = {}) {
  const job = await db().get("research_jobs", jobId);
  if (!job) return;
  await db().update("research_jobs", jobId, {
    ...patch,
    status,
    updated_at: nowIso(),
    log: [...job.log, { at: nowIso(), message: message ?? JOB_LABEL[status] }].slice(-60),
  });
}

/** Run a job after the HTTP response is sent (durable status lives in the database). */
export function runInBackground(jobId: string) {
  const task = () => executeJob(jobId).catch((e) => console.error("[plot twist] job crashed", jobId, e));
  try {
    after(task);
  } catch {
    // Outside a request scope (e.g. cron route already awaiting): run inline.
    void task();
  }
}

const running = new Set<string>();

export async function executeJob(jobId: string) {
  if (running.has(jobId)) return;
  running.add(jobId);
  try {
    const job = await db().get("research_jobs", jobId);
    if (!job || job.status === "completed") return;
    await db().update("research_jobs", jobId, { attempts: job.attempts + 1, updated_at: nowIso() });
    const { handlers } = await import("./handlers");
    const handler = handlers[job.kind];
    try {
      await handler({ ...job, attempts: job.attempts + 1 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await setJobStage(jobId, "failed", `Failed: ${msg}`, { error: msg });
    }
  } finally {
    running.delete(jobId);
  }
}

/** Jobs that are queued, or stuck mid-way for over 10 minutes, are retried (max 3 attempts). */
export async function resumeStaleJobs() {
  const jobs = await db().list("research_jobs", { orderBy: { column: "created_at" }, limit: 100 });
  const cutoff = Date.now() - 10 * 60 * 1000;
  const due = jobs.filter((j) => j.attempts < 3 && (j.status === "queued" || (!["completed", "failed"].includes(j.status) && new Date(j.updated_at).getTime() < cutoff)));
  for (const j of due) await executeJob(j.id);
  return due.length;
}
