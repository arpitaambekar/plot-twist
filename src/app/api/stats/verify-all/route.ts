import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { burstLimit, checkDailyLimit, recordUsage } from "@/lib/security/rate-limit";
import { searchConfigured } from "@/lib/search";
import { NotConfiguredError } from "@/lib/env";
import { applyStatCheck, verifyStat, type StatCheck } from "@/lib/stats/verify";
import { describeError } from "@/lib/errors";

export const maxDuration = 300;

/** Check every statistic that isn't Verified yet against live sources (about 4 search credits each). */
export const POST = route("editor", async ({ user }) => {
  if (!searchConfigured()) throw new NotConfiguredError("search", "Checking sources needs TAVILY_API_KEY (or BRAVE_SEARCH_API_KEY).");
  burstLimit(`stats-verify:${user.id}`, 2, 1);
  await checkDailyLimit(user.id, "research");
  const stats = (await db().list("outbound_stats", { limit: 200 })).filter((s) => s.status !== "Verified");
  const results: (StatCheck | { id: string; label: string; error: string })[] = [];
  for (const s of stats) {
    try {
      const c = await verifyStat(s, user.id);
      if (c.demo) {
        results.push({ ...c, status: s.status, reason: "Demo fixtures are on, so no live check ran and the status is unchanged." });
        continue;
      }
      await applyStatCheck(s, c, user.name);
      results.push(c);
    } catch (e) {
      results.push({ id: s.id, label: `${s.metric}, ${s.destination}, ${s.reporting_period}`, error: describeError(e) });
    }
  }
  await recordUsage(user.id, "research", 1, { task: "stats.verify_all", count: stats.length });
  await audit(user.email, "stats.verify_all", `${stats.length} statistics`);
  return { checked: stats.length, results };
});
