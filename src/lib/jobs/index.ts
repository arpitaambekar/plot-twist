import "server-only";
import { describeError } from "@/lib/errors";
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
      const msg = describeError(e);
      await setJobStage(jobId, "failed", `Failed: ${msg}`, { error: msg });
    }
  } finally {
    running.delete(jobId);
  }
}

// When this server process started. A job last touched before then was cut off by a restart
// (for example stopping the local app with Control + C) and can be resumed straight away.
const g = globalThis as unknown as { __ptProcStart?: number; __ptLastResume?: number };
g.__ptProcStart ??= Date.now();

/**
 * Jobs that are queued, interrupted by a restart, or stuck mid-way for over 10 minutes are retried
 * (max 3 attempts). Jobs that have used up their attempts are marked failed so the page offers Retry.
 */
export async function resumeStaleJobs() {
  const jobs = await db().list("research_jobs", { orderBy: { column: "created_at" }, limit: 100 });
  const cutoff = Date.now() - 10 * 60 * 1000;
  const unfinished = jobs.filter((j) => !["completed", "failed"].includes(j.status) && !running.has(j.id));
  const isStale = (j: ResearchJob) => {
    const t = new Date(j.updated_at).getTime();
    return j.status === "queued" || t < cutoff || t < g.__ptProcStart!;
  };
  const due = unfinished.filter((j) => isStale(j) && j.attempts < 3);
  for (const j of unfinished.filter((x) => isStale(x) && x.attempts >= 3)) {
    await setJobStage(j.id, "failed", "Stopped before finishing after 3 attempts", { error: "This job was interrupted several times. Use Retry to start it again." });
    // A report waiting on this job must not stay "Researching" forever: keep earlier content if any.
    if (j.kind === "destination_report") {
      for (const r of await db().list("reports", { where: { job_id: j.id } as never })) {
        if (r.status === "generating") await db().update("reports", r.id, { status: r.content ? (r.partial_notes.length ? "partial" : "completed") : "failed", updated_at: nowIso() });
      }
    }
  }
  for (const j of due) await executeJob(j.id);
  return due.length;
}

/** Called on page loads: resumes interrupted work in the background, at most once a minute. */
export function resumeStaleJobsSoon() {
  const now = Date.now();
  if (g.__ptLastResume && now - g.__ptLastResume < 60_000) return;
  g.__ptLastResume = now;
  void resumeStaleJobs().catch((e) => console.error("[plot twist] resuming jobs failed", e));
}
