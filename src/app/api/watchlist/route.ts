import { z } from "zod";
import { route, parseBody } from "@/lib/api";
import { db, newId, nowIso } from "@/lib/db";

const Body = z.object({ kind: z.enum(["destination", "tourism_board", "category", "india_market"]), value: z.string().min(1).max(160) });

export const GET = route("viewer", async ({ user }) => {
  const items = await db().list("watchlist", { where: { user_id: user.id } as never, orderBy: { column: "created_at" } });
  return { items };
});

/** Toggle follow/unfollow. Watchlists are personal, so viewers can follow too. */
export const POST = route("viewer", async ({ user, req }) => {
  const b = await parseBody(req, Body);
  const existing = (await db().list("watchlist", { where: { user_id: user.id, kind: b.kind, value: b.value } as never, limit: 1 }))[0];
  if (existing) {
    await db().remove("watchlist", existing.id);
    return { following: false };
  }
  const item = await db().insert("watchlist", { id: newId(), user_id: user.id, kind: b.kind, value: b.value, created_at: nowIso() });
  return { following: true, item };
});
