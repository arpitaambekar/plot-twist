import { z } from "zod";
import { route, parseBody } from "@/lib/api";
import { loadIdeaAndSet } from "@/lib/campaigns/access";
import { developPitch } from "@/lib/campaigns/pitch";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { burstLimit } from "@/lib/security/rate-limit";

export const maxDuration = 300;

export const GET = route("viewer", async ({ req }) => {
  const ideaId = new URL(req.url).searchParams.get("idea_id");
  const pitches = await db().list("pitches", { ...(ideaId ? { where: { idea_id: ideaId } as never } : {}), orderBy: { column: "updated_at" } });
  return { pitches };
});

/** Develop a shortlisted concept into an editable pitch (shortlisting it if it is still a draft). */
export const POST = route("editor", async ({ req, user }) => {
  burstLimit(`pitch:${user.id}`, 4, 2);
  const b = await parseBody(req, z.object({ idea_id: z.string() }));
  const { idea, set } = await loadIdeaAndSet(b.idea_id);
  if (idea.status === "rejected") return Response.json({ error: "Rejected concepts can't be developed into a pitch. Restore it to draft first.", code: "invalid" }, { status: 400 });
  const pitch = await developPitch(idea, set, user);
  if (idea.status === "draft") await db().update("campaign_ideas", idea.id, { status: "shortlisted" });
  await audit(user.email, "pitch.create", pitch.id, { idea: idea.id });
  return { pitch };
});
