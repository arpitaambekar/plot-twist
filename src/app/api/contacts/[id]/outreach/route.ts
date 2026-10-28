import { z } from "zod";
import { route, parseBody, notFound } from "@/lib/api";
import { db } from "@/lib/db";
import { draftOutreach } from "@/lib/contacts/outreach";
import { burstLimit } from "@/lib/security/rate-limit";

const Body = z.object({ opportunity_id: z.string().nullable().optional() });

/** Drafts an email for the user to copy and edit. Nothing is ever sent from plot twist. */
export const POST = route<{ id: string }>("editor", async ({ user, params, req }) => {
  const b = await parseBody(req, Body);
  const contact = await db().get("contacts", params.id);
  if (!contact) throw notFound("Contact");
  burstLimit(`outreach:${user.id}`, 6, 6);
  const opp = b.opportunity_id ? await db().get("opportunities", b.opportunity_id) : null;
  return draftOutreach(contact, opp, { id: user.id, name: user.name });
});
