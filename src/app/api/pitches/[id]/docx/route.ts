import { route, notFound } from "@/lib/api";
import { db } from "@/lib/db";
import { buildPitchDocx } from "@/lib/export/pitch-docx";
import { docxResponse } from "@/lib/export/docx-common";
import { recordUsage } from "@/lib/security/rate-limit";
import { audit } from "@/lib/audit";

export const maxDuration = 60;

export const GET = route<{ id: string }>("viewer", async ({ params, user }) => {
  const pitch = await db().get("pitches", params.id);
  if (!pitch) throw notFound("Pitch");
  const idea = await db().get("campaign_ideas", pitch.idea_id);
  if (!idea) throw notFound("Campaign idea");
  const sources = pitch.source_ids.length ? await db().list("sources", { in: { column: "id", values: pitch.source_ids } }) : [];
  const buf = await buildPitchDocx(pitch, idea, sources);
  await recordUsage(user.id, "export", 1, { pitch: pitch.id });
  await audit(user.email, "pitch.export.docx", pitch.id);
  const safe = `${pitch.destination}-${idea.content.name}`.replace(/[^\w\- ]+/g, "").replace(/\s+/g, "-").slice(0, 80);
  return docxResponse(buf, `plot-twist-pitch-${safe}.docx`);
});
