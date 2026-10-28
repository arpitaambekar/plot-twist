import { z } from "zod";
import { route, parseBody, notFound } from "@/lib/api";
import { db, nowIso } from "@/lib/db";
import { loadIdeaAndSet } from "@/lib/campaigns/access";
import { addRevision } from "@/lib/campaigns/service";

/** Restore an earlier version as a new version (history is never rewritten). */
export const POST = route<{ id: string }>("editor", async ({ params, req, user }) => {
  const b = await parseBody(req, z.object({ revision_id: z.string() }));
  const { idea } = await loadIdeaAndSet(params.id);
  const rev = await db().get("campaign_revisions", b.revision_id);
  if (!rev || rev.idea_id !== idea.id) throw notFound("Revision");
  const updated = (await db().update("campaign_ideas", idea.id, { content: rev.content, locked_fields: rev.locked_fields, version: idea.version + 1, updated_at: nowIso() }))!;
  await addRevision(updated, `Restored version ${rev.version}`, user.name);
  return { idea: updated };
});
