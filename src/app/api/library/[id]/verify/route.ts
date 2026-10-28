import { route, notFound } from "@/lib/api";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { burstLimit } from "@/lib/security/rate-limit";
import { applyVerification, verifyReference } from "@/lib/library/verify";

export const maxDuration = 120;

export const POST = route<{ id: string }>("editor", async ({ user, params }) => {
  burstLimit(`library-verify:${user.id}`, 5, 5);
  const ref = await db().get("reference_campaigns", params.id);
  if (!ref) throw notFound("Reference campaign");
  const v = await verifyReference(ref, user.id);
  const item = await applyVerification(ref, v);
  await audit(user.email, "library.verify", `reference:${ref.id}`, {
    status: v.demo ? ref.verification : v.status,
    reason: v.demo ? "Demo fixtures are on: verification status was not changed." : v.reason,
    matched: v.matched.map((m) => m.url),
    checked: v.checked,
    demo: v.demo,
  });
  return { item, result: v };
});
