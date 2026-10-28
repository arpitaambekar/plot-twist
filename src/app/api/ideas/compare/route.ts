import { z } from "zod";
import { route, parseBody, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { compareIdeas } from "@/lib/campaigns/refine";

export const maxDuration = 300;

export const POST = route("editor", async ({ req, user }) => {
  const b = await parseBody(req, z.object({ idea_ids: z.array(z.string()).min(2).max(4) }));
  const ideas = await db().list("campaign_ideas", { in: { column: "id", values: b.idea_ids } });
  if (ideas.length !== b.idea_ids.length) throw new HttpError(404, "One of those concepts no longer exists.");
  const ordered = b.idea_ids.map((id) => ideas.find((i) => i.id === id)!);
  return { comparison: await compareIdeas(ordered, user.id, user.id) };
});
