import { z } from "zod";
import { route, parseBody, HttpError } from "@/lib/api";
import { db, nowIso } from "@/lib/db";
import { loadIdeaAndSet } from "@/lib/campaigns/access";
import { applyChanges, addRevision, EDITABLE_FIELDS } from "@/lib/campaigns/service";
import { researchBehind } from "@/lib/campaigns/pitch";
import { audit } from "@/lib/audit";

export const GET = route<{ id: string }>("viewer", async ({ params }) => {
  const { idea, set } = await loadIdeaAndSet(params.id);
  const [revisions, comments, research, report, pitches] = await Promise.all([
    db().list("campaign_revisions", { where: { idea_id: idea.id } as never, orderBy: { column: "version" } }),
    db().list("campaign_comments", { where: { idea_id: idea.id } as never, orderBy: { column: "created_at", ascending: true } }),
    researchBehind(idea),
    idea.report_id ? db().get("reports", idea.report_id) : Promise.resolve(null),
    db().list("pitches", { where: { idea_id: idea.id } as never, orderBy: { column: "updated_at" } }),
  ]);
  const parents = idea.parent_ids.length ? await db().list("campaign_ideas", { in: { column: "id", values: idea.parent_ids } }) : [];
  return {
    idea,
    set: { id: set.id, title: set.title, destination: set.destination, input_mode: set.input_mode, supplied_filename: set.supplied_filename, brief: set.brief },
    revisions,
    comments,
    research,
    report: report ? { id: report.id, destination_name: report.destination_name, version: report.version } : null,
    pitches: pitches.map((p) => ({ id: p.id, title: p.title, updated_at: p.updated_at })),
    parents: parents.map((p) => ({ id: p.id, name: p.content.name })),
  };
});

const Patch = z.object({
  /** Manual or AI-applied field edits. */
  content: z.record(z.string(), z.string().max(12000)).optional(),
  dependency_flags: z.array(z.string().max(80)).max(8).optional(),
  /** "manual" locks edited fields; "ai" applies an accepted refinement preview without locking. */
  source: z.enum(["manual", "ai"]).default("manual"),
  action: z.string().max(200).optional(),
  status: z.enum(["draft", "shortlisted", "rejected", "approved"]).optional(),
  reviewer: z.string().max(120).nullable().optional(),
  approval_note: z.string().max(4000).nullable().optional(),
  unlock_fields: z.array(z.string()).optional(),
  expected_version: z.number().int().optional(),
});

export const PATCH = route<{ id: string }>("editor", async ({ params, req, user }) => {
  const b = await parseBody(req, Patch);
  let { idea } = await loadIdeaAndSet(params.id);
  if (b.expected_version && b.expected_version !== idea.version && b.content) {
    throw new HttpError(409, "This concept was changed by someone else. Reload to see the latest version before editing.");
  }
  if (b.status === "approved" && !(b.approval_note ?? idea.approval_note)) throw new HttpError(400, "Add a final approval note before approving.");

  const meta: Record<string, unknown> = {};
  if (b.status) meta.status = b.status;
  if (b.reviewer !== undefined) meta.reviewer = b.reviewer;
  if (b.approval_note !== undefined) meta.approval_note = b.approval_note;

  if (b.content || b.dependency_flags) {
    const changes: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(b.content ?? {})) if (EDITABLE_FIELDS.includes(k)) changes[k] = v;
    if (b.dependency_flags) changes.dependency_flags = b.dependency_flags;
    idea = await applyChanges(idea, changes, {
      manual: b.source === "manual",
      action: b.action ?? (b.source === "manual" ? `Edited ${Object.keys(changes).join(", ").replace(/_/g, " ")}` : "AI refinement applied"),
      author: user.name,
      extra: Object.keys(meta).length ? (meta as never) : undefined,
    });
  } else if (Object.keys(meta).length || b.unlock_fields) {
    const locked = b.unlock_fields ? idea.locked_fields.filter((f) => !b.unlock_fields!.includes(f)) : idea.locked_fields;
    idea = (await db().update("campaign_ideas", idea.id, { ...meta, locked_fields: locked, version: idea.version + 1, updated_at: nowIso() })) ?? idea;
    const what = b.status ? `Marked ${b.status}` : b.unlock_fields ? `Unlocked ${b.unlock_fields.join(", ")}` : b.reviewer !== undefined ? `Reviewer: ${b.reviewer ?? "none"}` : "Updated approval note";
    await addRevision(idea, what, user.name);
  }
  if (b.status) await audit(user.email, `idea.${b.status}`, idea.id);
  return { idea };
});
