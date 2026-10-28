import { route, notFound } from "@/lib/api";
import { db } from "@/lib/db";
import { NotConfiguredError } from "@/lib/env";
import { searchConfigured } from "@/lib/search";
import { reverifyContact } from "@/lib/contacts/discover";
import { burstLimit, checkDailyLimit } from "@/lib/security/rate-limit";

export const maxDuration = 120;

export const POST = route<{ id: string }>("editor", async ({ user, params }) => {
  const contact = await db().get("contacts", params.id);
  if (!contact) throw notFound("Contact");
  if (!searchConfigured()) throw new NotConfiguredError("search");
  burstLimit(`reverify:${user.id}`, 5, 5);
  await checkDailyLimit(user.id, "contact_search");
  const updated = await reverifyContact(contact, user.id, user.name);
  return { contact: updated };
});
