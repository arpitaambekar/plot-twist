import { z } from "zod";
import { route, parseBody, notFound } from "@/lib/api";
import { db, newId, nowIso } from "@/lib/db";
import { audit } from "@/lib/audit";

const Body = z.object({ action: z.enum(["confirm", "flag"]), note: z.string().max(500).default("") });

/** Record a human re-check: "confirm" (opened the source, figure matches) or "flag" (could not confirm). */
export const PATCH = route<{ id: string }>("editor", async ({ user, params, req }) => {
  const b = await parseBody(req, Body);
  const s = await db().get("outbound_stats", params.id);
  if (!s) throw notFound("Statistic");
  const primary = ["official", "government", "tourism_board"].includes(s.source_type);
  const status = b.action === "confirm" ? (primary ? "Verified" : "Needs Verification") : "Unverified";
  const updated = await db().update("outbound_stats", s.id, { status, verified_at: nowIso() });
  await db().insert("verification_events", {
    id: newId(),
    subject_type: "claim",
    subject_id: s.id,
    status,
    note: b.note || (b.action === "confirm" ? "Figure confirmed against the source" : "Could not confirm figure in the source"),
    actor: user.name,
    created_at: nowIso(),
  });
  await audit(user.email, `stat.${b.action}`, s.id);
  return { stat: updated };
});

export const DELETE = route<{ id: string }>("editor", async ({ user, params }) => {
  await db().remove("outbound_stats", params.id);
  await audit(user.email, "stat.delete", params.id);
  return { ok: true };
});
