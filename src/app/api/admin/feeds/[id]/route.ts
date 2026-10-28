import { route, parseBody, notFound, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { safeUrl } from "@/lib/security/content";
import { FeedInput } from "../schema";

export const PATCH = route<{ id: string }>("admin", async ({ user, params, req }) => {
  const feed = await db().get("feeds", params.id);
  if (!feed) throw notFound("Feed");
  const b = await parseBody(req, FeedInput.partial());
  const patch: Record<string, unknown> = { ...b };
  if (b.url !== undefined) {
    const url = safeUrl(b.url);
    if (!url) throw new HttpError(400, "Feed URL must be a public http(s) address.");
    patch.url = url;
    // A changed URL has not been checked yet.
    if (url !== feed.url) Object.assign(patch, { last_status: "never", last_checked_at: null, last_error: null, item_count: 0 });
  }
  const updated = await db().update("feeds", params.id, patch);
  await audit(user.email, "admin.feed.update", `feed:${params.id}`, { fields: Object.keys(b) });
  return { feed: updated };
});

export const DELETE = route<{ id: string }>("admin", async ({ user, params }) => {
  const feed = await db().get("feeds", params.id);
  if (!feed) throw notFound("Feed");
  await db().remove("feeds", params.id);
  await audit(user.email, "admin.feed.delete", `feed:${params.id}`, { url: feed.url });
  return { ok: true };
});
