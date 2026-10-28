import { z } from "zod";
import { route, parseBody, notFound } from "@/lib/api";
import { db, newId, nowIso } from "@/lib/db";
import { loadBundle } from "@/lib/opportunities/load";
import { MANUAL_CRITERIA } from "@/lib/opportunities/readiness";
import { audit } from "@/lib/audit";
import { STAGES, type Opportunity } from "@/lib/types";

export const GET = route<{ id: string }>("viewer", async ({ params }) => {
  const o = await db().get("opportunities", params.id);
  if (!o) throw notFound("Opportunity");
  const [bundle, activities] = await Promise.all([loadBundle(o), db().list("opportunity_activities", { where: { opportunity_id: o.id } as never, orderBy: { column: "created_at" } })]);
  return { ...bundle, activities };
});

const nullableText = (max: number) => z.string().max(max).nullable().optional();
const Patch = z.object({
  name: z.string().min(2).max(200).optional(),
  destination: z.string().min(1).max(120).optional(),
  tourism_board: nullableText(200),
  summary: z.string().max(4000).optional(),
  stage: z.enum(STAGES).optional(),
  priority: z.enum(["High", "Medium", "Low"]).optional(),
  owner: nullableText(120),
  next_action: nullableText(500),
  next_action_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  campaign_window: nullableText(200),
  commercial_notes: nullableText(2000),
  notes: z.string().max(10000).optional(),
  shortlisted_idea_id: z.string().nullable().optional(),
  manual_checks: z.record(z.string(), z.boolean().nullable()).optional(),
});

export const PATCH = route<{ id: string }>("editor", async ({ user, params, req }) => {
  const b = await parseBody(req, Patch);
  const o = await db().get("opportunities", params.id);
  if (!o) throw notFound("Opportunity");
  const patch: Partial<Opportunity> = { ...b, updated_at: nowIso() };
  const log: string[] = [];
  if (b.manual_checks) {
    const merged = { ...o.manual_checks };
    for (const [k, v] of Object.entries(b.manual_checks)) {
      if (!(k in MANUAL_CRITERIA)) continue;
      if (merged[k] !== v) log.push(`${MANUAL_CRITERIA[k].label}: ${v === true ? "confirmed" : v === false ? "not yet" : "not assessed"}`);
      merged[k] = v;
    }
    patch.manual_checks = merged;
  }
  if (b.stage && b.stage !== o.stage) log.push(`Stage changed from ${o.stage} to ${b.stage}`);
  if (b.owner !== undefined && b.owner !== o.owner) log.push(`Owner set to ${b.owner || "unassigned"}`);
  if (b.next_action !== undefined && b.next_action !== o.next_action && b.next_action) log.push(`Next action: ${b.next_action}${b.next_action_date ? ` (by ${b.next_action_date})` : ""}`);
  if (b.priority && b.priority !== o.priority) log.push(`Priority set to ${b.priority}`);
  const updated = await db().update("opportunities", o.id, patch);
  for (const body of log) {
    await db().insert("opportunity_activities", {
      id: newId(),
      opportunity_id: o.id,
      kind: body.startsWith("Stage") ? "stage_change" : "update",
      body,
      author: user.name,
      created_at: nowIso(),
    });
  }
  return { opportunity: updated };
});

export const DELETE = route<{ id: string }>("editor", async ({ user, params }) => {
  const o = await db().get("opportunities", params.id);
  if (!o) throw notFound("Opportunity");
  const acts = await db().list("opportunity_activities", { where: { opportunity_id: o.id } as never });
  for (const a of acts) await db().remove("opportunity_activities", a.id);
  await db().remove("opportunities", o.id);
  await audit(user.email, "opportunity.delete", o.id, { name: o.name });
  return { ok: true };
});
