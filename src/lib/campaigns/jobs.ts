import "server-only";
import { db, nowIso } from "@/lib/db";
import { runInBackground } from "@/lib/jobs";
import type { ResearchJob } from "@/lib/types";

export const jobIdForSet = (setId: string) => `job_cs_${setId}`;

/** One durable job per campaign set (deterministic id, so the workspace can always find it). */
export async function startSetJob(setId: string, author: { id: string; name: string }) {
  const id = jobIdForSet(setId);
  const existing = await db().get("research_jobs", id);
  const job: ResearchJob = {
    id,
    kind: "campaign_generation",
    status: "queued",
    input: { set_id: setId, author_name: author.name },
    result_id: null,
    error: null,
    attempts: existing?.attempts ?? 0,
    log: [...(existing?.log ?? []), { at: nowIso(), message: existing ? "Retry requested" : "Job created" }].slice(-60),
    created_by: author.id,
    created_at: existing?.created_at ?? nowIso(),
    updated_at: nowIso(),
  };
  if (existing) await db().update("research_jobs", id, { ...job, attempts: 0 });
  else await db().insert("research_jobs", job);
  runInBackground(id);
  return job;
}
