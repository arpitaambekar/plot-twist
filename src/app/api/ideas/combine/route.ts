import { z } from "zod";
import { route, parseBody, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { combineIdeas } from "@/lib/campaigns/refine";

export const maxDuration = 300;

export const POST = route("editor", async ({ req, user }) => {
  const b = await parseBody(req, z.object({ idea_ids: z.array(z.string()).length(2) }));
  const [a, c] = await Promise.all(b.idea_ids.map((id) => db().get("campaign_ideas", id)));
  if (!a || !c) throw new HttpError(404, "One of those concepts no longer exists.");
  if (a.destination.toLowerCase() !== c.destination.toLowerCase()) throw new HttpError(400, "Combine concepts for the same destination.");
  const ok = (s: string) => s === "shortlisted" || s === "approved";
  if (!ok(a.status) || !ok(c.status)) throw new HttpError(400, "Shortlist both concepts before combining them.");
  const set = await db().get("campaign_sets", a.set_id);
  if (!set) throw new HttpError(404, "Campaign set not found.");
  return { idea: await combineIdeas(a, c, set, user) };
});
