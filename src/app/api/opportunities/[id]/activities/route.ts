import { z } from "zod";
import { route, parseBody, notFound } from "@/lib/api";
import { db, newId, nowIso } from "@/lib/db";

const Body = z.object({
  kind: z.enum(["note", "outreach_recorded", "meeting_recorded"]),
  body: z.string().min(1).max(4000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * Activities are recorded by people. Outreach and meetings are only logged here when a team
 * member says they happened; plot twist never sends email or claims contact on its own.
 */
export const POST = route<{ id: string }>("editor", async ({ user, params, req }) => {
  const b = await parseBody(req, Body);
  const o = await db().get("opportunities", params.id);
  if (!o) throw notFound("Opportunity");
  const prefix = b.kind === "outreach_recorded" ? `Outreach recorded by ${user.name}${b.date ? ` (${b.date})` : ""}: ` : b.kind === "meeting_recorded" ? `Meeting recorded by ${user.name}${b.date ? ` (${b.date})` : ""}: ` : "";
  const activity = await db().insert("opportunity_activities", { id: newId(), opportunity_id: o.id, kind: b.kind, body: prefix + b.body, author: user.name, created_at: nowIso() });
  if (b.kind !== "note") {
    await db().update("opportunities", o.id, { last_interaction: `${b.kind === "outreach_recorded" ? "Outreach" : "Meeting"} on ${b.date ?? nowIso().slice(0, 10)} (recorded by ${user.name})`, updated_at: nowIso() });
  } else {
    await db().update("opportunities", o.id, { updated_at: nowIso() });
  }
  return { activity };
});
