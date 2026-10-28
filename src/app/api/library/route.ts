import { route, parseBody, HttpError } from "@/lib/api";
import { db, nowIso } from "@/lib/db";
import { audit } from "@/lib/audit";
import { safeUrl, hostOf } from "@/lib/security/content";
import { slugify } from "@/lib/seed";
import type { ReferenceCampaign } from "@/lib/types";
import { ReferenceInput } from "./schema";

export const GET = route("viewer", async () => {
  const items = await db().list("reference_campaigns", { orderBy: { column: "launch_date" } });
  return { items };
});

/** Manually added references start as "Needs Verification" until Re-verify finds supporting evidence. */
export const POST = route("editor", async ({ user, req }) => {
  const b = await parseBody(req, ReferenceInput);
  const sources = b.sources.filter((s) => safeUrl(s.url)).map((s) => ({ ...s, url: safeUrl(s.url)!, publisher: s.publisher || hostOf(s.url) }));
  if (!sources.length) throw new HttpError(400, "At least one valid source URL is required.");
  const ref: ReferenceCampaign = {
    ...b,
    id: slugify(`${b.tourism_board}-${b.name}`).slice(0, 70) + "-" + Math.random().toString(36).slice(2, 6),
    launch_date: b.launch_date || null,
    official_link: safeUrl(b.official_link ?? null),
    published_results: b.published_results || null,
    sources,
    verification: "Needs Verification",
    verified_at: nowIso(),
    image: null,
    created_at: nowIso(),
  };
  await db().insert("reference_campaigns", ref);
  await audit(user.email, "library.create", `reference:${ref.id}`, { name: ref.name });
  return { item: ref };
});
