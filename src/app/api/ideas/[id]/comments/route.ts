import { z } from "zod";
import { route, parseBody } from "@/lib/api";
import { db, newId, nowIso } from "@/lib/db";
import { loadIdeaAndSet } from "@/lib/campaigns/access";

export const POST = route<{ id: string }>("editor", async ({ params, req, user }) => {
  const b = await parseBody(req, z.object({ body: z.string().min(1).max(4000), kind: z.enum(["comment", "note"]).default("comment") }));
  const { idea } = await loadIdeaAndSet(params.id);
  const comment = { id: newId("cmt_"), idea_id: idea.id, kind: b.kind, body: b.body, author: user.name, created_at: nowIso() };
  await db().insert("campaign_comments", comment);
  return { comment };
});
