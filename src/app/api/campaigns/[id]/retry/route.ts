import { route, notFound, HttpError } from "@/lib/api";
import { db, nowIso } from "@/lib/db";
import { startSetJob } from "@/lib/campaigns/jobs";

/** Retry a failed generation, or fill in missing extras. Existing ideas are kept. */
export const POST = route<{ id: string }>("editor", async ({ params, user }) => {
  const set = await db().get("campaign_sets", params.id);
  if (!set) throw notFound("Campaign set");
  if (set.status === "generating") throw new HttpError(409, "Generation is already running.");
  await db().update("campaign_sets", set.id, { status: "generating", error: null, updated_at: nowIso() });
  await startSetJob(set.id, user);
  return { ok: true };
});
