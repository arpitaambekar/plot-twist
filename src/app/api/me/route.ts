import { z } from "zod";
import { route, parseBody } from "@/lib/api";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

export const GET = route("viewer", async ({ user }) => {
  const profile = await db().get("profiles", user.id);
  return { user: { ...user, name: profile?.name ?? user.name } };
});

/** Users may edit their own display name only; roles are changed by admins in /admin. */
export const PATCH = route("viewer", async ({ user, req }) => {
  const b = await parseBody(req, z.object({ name: z.string().trim().min(1).max(100) }));
  const profile = await db().update("profiles", user.id, { name: b.name });
  await audit(user.email, "profile.update", `profile:${user.id}`, { name: b.name });
  return { profile };
});
