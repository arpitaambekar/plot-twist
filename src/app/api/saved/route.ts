import { z } from "zod";
import { route, parseBody } from "@/lib/api";
import { db, newId, nowIso } from "@/lib/db";

const Body = z.object({
  item_type: z.enum(["news", "report", "idea", "contact", "reference", "pitch", "opportunity"]),
  item_id: z.string().min(1).max(200),
  label: z.string().max(300).default(""),
});

export const GET = route("viewer", async ({ user, req }) => {
  const type = new URL(req.url).searchParams.get("type");
  const items = await db().list("saved_items", { where: { user_id: user.id, ...(type ? { item_type: type } : {}) } as never, orderBy: { column: "created_at" } });
  return { items };
});

/** Toggle: saves the item, or removes it if already saved. Saving is personal, so viewers can save too. */
export const POST = route("viewer", async ({ user, req }) => {
  const b = await parseBody(req, Body);
  const existing = (await db().list("saved_items", { where: { user_id: user.id, item_type: b.item_type, item_id: b.item_id } as never, limit: 1 }))[0];
  if (existing) {
    await db().remove("saved_items", existing.id);
    return { saved: false };
  }
  await db().insert("saved_items", { id: newId(), user_id: user.id, item_type: b.item_type, item_id: b.item_id, label: b.label, created_at: nowIso() });
  return { saved: true };
});
