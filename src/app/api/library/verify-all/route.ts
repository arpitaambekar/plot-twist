import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { burstLimit, checkDailyLimit, recordUsage } from "@/lib/security/rate-limit";
import { searchConfigured } from "@/lib/search";
import { NotConfiguredError } from "@/lib/env";
import { applyVerification, verifyReference } from "@/lib/library/verify";
import { describeError } from "@/lib/errors";

export const maxDuration = 300;

/** Re-verify every reference campaign that isn't Verified yet (about 6 search credits each). */
export const POST = route("editor", async ({ user }) => {
  if (!searchConfigured()) throw new NotConfiguredError("search", "Verification needs TAVILY_API_KEY (or BRAVE_SEARCH_API_KEY).");
  burstLimit(`library-verify:${user.id}`, 2, 1);
  await checkDailyLimit(user.id, "research");
  const refs = (await db().list("reference_campaigns", { limit: 300 })).filter((r) => r.verification !== "Verified");
  const results: { id: string; name: string; status?: string; previous: string; reason?: string; error?: string }[] = [];
  for (const r of refs) {
    try {
      const v = await verifyReference(r, user.id);
      if (v.demo) {
        results.push({ id: r.id, name: r.name, previous: r.verification, status: r.verification, reason: "Demo fixtures are on, so no live check ran and the status is unchanged." });
        continue;
      }
      // A failed lookup never downgrades a reference that already had evidence.
      const keep = v.status === "Unverified" && r.verification !== "Unverified";
      if (!keep) await applyVerification(r, v);
      results.push({ id: r.id, name: r.name, previous: r.verification, status: keep ? r.verification : v.status, reason: keep ? `${v.reason} Status kept.` : v.reason });
    } catch (e) {
      results.push({ id: r.id, name: r.name, previous: r.verification, error: describeError(e) });
    }
  }
  await recordUsage(user.id, "research", 1, { task: "library.verify_all", count: refs.length });
  await audit(user.email, "library.verify_all", `${refs.length} references`);
  return { checked: refs.length, results };
});
