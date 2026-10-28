import { z } from "zod";
import { route, parseBody, notFound, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

export const PATCH = route<{ id: string }>("admin", async ({ user, params, req }) => {
  const { role } = await parseBody(req, z.object({ role: z.enum(["admin", "editor", "viewer"]) }));
  const target = await db().get("profiles", params.id);
  if (!target) throw notFound("User");
  if (target.role === "admin" && role !== "admin") {
    const admins = (await db().list("profiles", { where: { role: "admin" } as never })).length;
    if (admins <= 1) throw new HttpError(400, "There must be at least one admin. Promote someone else first.");
  }
  const updated = await db().update("profiles", params.id, { role });
  await audit(user.email, "admin.user.role", `profile:${params.id}`, { email: target.email, from: target.role, to: role });
  return { profile: updated };
});
