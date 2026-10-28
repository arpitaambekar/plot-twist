import { route, parseBody, notFound } from "@/lib/api";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { safeUrl } from "@/lib/security/content";
import { ReferenceInput } from "../schema";

export const GET = route<{ id: string }>("viewer", async ({ params }) => {
  const item = await db().get("reference_campaigns", params.id);
  if (!item) throw notFound("Reference campaign");
  const checks = (await db().list("audit_log", { where: { target: `reference:${params.id}` } as never, orderBy: { column: "created_at" }, limit: 10 })).filter((a) => a.action === "library.verify");
  return { item, checks };
});

/** Editing a reference is admin-only; edits never upgrade verification status. */
export const PATCH = route<{ id: string }>("admin", async ({ user, params, req }) => {
  const existing = await db().get("reference_campaigns", params.id);
  if (!existing) throw notFound("Reference campaign");
  const b = await parseBody(req, ReferenceInput.partial());
  const patch = {
    ...b,
    ...(b.official_link !== undefined ? { official_link: safeUrl(b.official_link) } : {}),
    ...(b.sources ? { sources: b.sources.filter((s) => safeUrl(s.url)) } : {}),
  };
  const item = await db().update("reference_campaigns", params.id, patch);
  await audit(user.email, "library.update", `reference:${params.id}`, { fields: Object.keys(b) });
  return { item };
});

export const DELETE = route<{ id: string }>("admin", async ({ user, params }) => {
  const existing = await db().get("reference_campaigns", params.id);
  if (!existing) throw notFound("Reference campaign");
  await db().remove("reference_campaigns", params.id);
  await audit(user.email, "library.delete", `reference:${params.id}`, { name: existing.name });
  return { ok: true };
});
