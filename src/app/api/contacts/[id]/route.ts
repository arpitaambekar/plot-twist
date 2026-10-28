import { z } from "zod";
import { route, parseBody, notFound } from "@/lib/api";
import { db, nowIso } from "@/lib/db";
import { audit } from "@/lib/audit";

export const GET = route<{ id: string }>("viewer", async ({ params }) => {
  const contact = await db().get("contacts", params.id);
  if (!contact) throw notFound("Contact");
  const history = await db().list("verification_events", { where: { subject_type: "contact", subject_id: contact.id } as never, orderBy: { column: "created_at" } });
  return { contact, history };
});

/** Only internal fields are editable. Verified details change only through verification. */
const Patch = z.object({ notes: z.string().max(5000).optional() });

export const PATCH = route<{ id: string }>("editor", async ({ user, params, req }) => {
  const b = await parseBody(req, Patch);
  const contact = await db().update("contacts", params.id, { ...b, updated_at: nowIso() });
  if (!contact) throw notFound("Contact");
  await audit(user.email, "contacts.update", params.id, { fields: Object.keys(b) });
  return { contact };
});

export const DELETE = route<{ id: string }>("admin", async ({ user, params }) => {
  await db().remove("contacts", params.id);
  await audit(user.email, "contacts.delete", params.id);
  return { ok: true };
});
