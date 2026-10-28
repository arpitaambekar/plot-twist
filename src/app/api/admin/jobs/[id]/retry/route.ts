import { route, notFound, HttpError } from "@/lib/api";
import { db, nowIso } from "@/lib/db";
import { audit } from "@/lib/audit";
import { runInBackground } from "@/lib/jobs";

/** Re-queue a failed job and run it again in the background. */
export const POST = route<{ id: string }>("admin", async ({ user, params }) => {
  const job = await db().get("research_jobs", params.id);
  if (!job) throw notFound("Job");
  if (job.status !== "failed") throw new HttpError(400, "Only failed jobs can be retried.");
  await db().update("research_jobs", job.id, {
    status: "queued",
    error: null,
    updated_at: nowIso(),
    log: [...job.log, { at: nowIso(), message: `Retry requested by ${user.name}` }].slice(-60),
  });
  runInBackground(job.id);
  await audit(user.email, "admin.job.retry", `job:${job.id}`, { kind: job.kind, attempts: job.attempts });
  return { ok: true };
});
