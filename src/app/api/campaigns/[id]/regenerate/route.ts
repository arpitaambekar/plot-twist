import { z } from "zod";
import { route, parseBody, notFound } from "@/lib/api";
import { db } from "@/lib/db";
import { regenerateIdea } from "@/lib/campaigns/generate";
import { burstLimit } from "@/lib/security/rate-limit";

export const maxDuration = 300;

/**
 * Regenerate selected ideas, optionally against the newest report version.
 * Only the selected ideas change; manually edited fields stay locked; each change is a restorable revision.
 */
export const POST = route<{ id: string }>("editor", async ({ params, user, req }) => {
  burstLimit(`regen:${user.id}`, 6, 3);
  const b = await parseBody(req, z.object({ idea_ids: z.array(z.string()).min(1).max(10), use_latest: z.boolean().default(false) }));
  const set = await db().get("campaign_sets", params.id);
  if (!set) throw notFound("Campaign set");
  const report = set.report_id ? await db().get("reports", set.report_id) : null;
  const version = b.use_latest && report ? report.version : null;
  const ideas = (await db().list("campaign_ideas", { in: { column: "id", values: b.idea_ids } })).filter((i) => i.set_id === set.id);
  const updated = [];
  for (const idea of ideas) updated.push(await regenerateIdea(idea, set, user, version));
  return { ideas: updated };
});
