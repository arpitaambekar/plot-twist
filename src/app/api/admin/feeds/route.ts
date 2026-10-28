import { route, parseBody, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { safeUrl } from "@/lib/security/content";
import { slugify } from "@/lib/seed";
import type { FeedConfig } from "@/lib/types";
import { FeedInput } from "./schema";


export const GET = route("admin", async () => ({ feeds: await db().list("feeds") }));

/** New feeds start as "never checked"; status is only set by a real ingestion run. */
export const POST = route("admin", async ({ user, req }) => {
  const b = await parseBody(req, FeedInput);
  const url = safeUrl(b.url);
  if (!url) throw new HttpError(400, "Feed URL must be a public http(s) address.");
  const all = await db().list("feeds");
  if (all.some((f) => f.url === url)) throw new HttpError(409, "That feed is already configured.");
  const feed: FeedConfig = { ...b, url, id: slugify(b.name) + "-" + Math.random().toString(36).slice(2, 6), last_status: "never", last_checked_at: null, last_error: null, item_count: 0 };
  await db().insert("feeds", feed);
  await audit(user.email, "admin.feed.create", `feed:${feed.id}`, { url });
  return { feed };
});
