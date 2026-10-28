import { z } from "zod";
import { route, parseBody, notFound } from "@/lib/api";
import { db, nowIso } from "@/lib/db";
import { jobIdForSet } from "@/lib/campaigns/jobs";
import { JOB_LABEL } from "@/lib/jobs";

export const GET = route<{ id: string }>("viewer", async ({ params, user }) => {
  const set = await db().get("campaign_sets", params.id);
  if (!set) throw notFound("Campaign set");
  const [ideas, job, report, saved] = await Promise.all([
    db().list("campaign_ideas", { where: { set_id: set.id } as never, orderBy: { column: "created_at", ascending: true } }),
    db().get("research_jobs", jobIdForSet(set.id)),
    set.report_id ? db().get("reports", set.report_id) : Promise.resolve(null),
    db().list("saved_items", { where: { user_id: user.id, item_type: "idea" } as never }),
  ]);
  const pitches = ideas.length ? await db().list("pitches", { in: { column: "idea_id", values: ideas.map((i) => i.id) } }) : [];
  return {
    set: { ...set, supplied_research: set.supplied_research ? `${set.supplied_research.slice(0, 600)}…` : null },
    ideas,
    job: job ? { ...job, label: JOB_LABEL[job.status] } : null,
    report: report ? { id: report.id, destination_name: report.destination_name, version: report.version, status: report.status } : null,
    pitches: pitches.map((p) => ({ id: p.id, idea_id: p.idea_id, title: p.title, updated_at: p.updated_at })),
    saved_ids: saved.map((s) => s.item_id),
  };
});

export const PATCH = route<{ id: string }>("editor", async ({ params, req }) => {
  const b = await parseBody(req, z.object({ title: z.string().min(2).max(200) }));
  const set = await db().update("campaign_sets", params.id, { title: b.title, updated_at: nowIso() });
  if (!set) throw notFound("Campaign set");
  return { set };
});
