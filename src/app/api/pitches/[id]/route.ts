import { z } from "zod";
import { route, parseBody, notFound, HttpError } from "@/lib/api";
import { db, nowIso } from "@/lib/db";
import { PITCH_SECTIONS } from "@/lib/types";

export const GET = route<{ id: string }>("viewer", async ({ params }) => {
  const pitch = await db().get("pitches", params.id);
  if (!pitch) throw notFound("Pitch");
  const idea = await db().get("campaign_ideas", pitch.idea_id);
  const sources = pitch.source_ids.length ? await db().list("sources", { in: { column: "id", values: pitch.source_ids } }) : [];
  return { pitch, idea, sources };
});

const keys = PITCH_SECTIONS.map(([k]) => k) as string[];

export const PATCH = route<{ id: string }>("editor", async ({ params, req }) => {
  const b = await parseBody(req, z.object({ title: z.string().min(2).max(300).optional(), sections: z.record(z.string(), z.string().max(20000)).optional(), expected_version: z.number().int().optional() }));
  const pitch = await db().get("pitches", params.id);
  if (!pitch) throw notFound("Pitch");
  if (b.expected_version && b.expected_version !== pitch.version) throw new HttpError(409, "This pitch changed since you opened it. Reload to continue.");
  const sections = { ...pitch.sections };
  for (const [k, v] of Object.entries(b.sections ?? {})) if (keys.includes(k)) (sections as Record<string, string>)[k] = v;
  const updated = await db().update("pitches", pitch.id, { title: b.title ?? pitch.title, sections, version: pitch.version + 1, updated_at: nowIso() });
  return { pitch: updated };
});
