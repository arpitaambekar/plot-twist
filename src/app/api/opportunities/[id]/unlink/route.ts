import { z } from "zod";
import { route, parseBody, notFound } from "@/lib/api";
import { db, newId, nowIso } from "@/lib/db";
import type { Opportunity } from "@/lib/types";

const Body = z.object({
  field: z.enum(["news_ids", "idea_ids", "contact_ids", "report_id", "pitch_id", "shortlisted_idea_id", "source_links"]),
  value: z.string().min(1),
});

export const POST = route<{ id: string }>("editor", async ({ user, params, req }) => {
  const b = await parseBody(req, Body);
  const o = await db().get("opportunities", params.id);
  if (!o) throw notFound("Opportunity");
  const patch: Partial<Opportunity> = { updated_at: nowIso() };
  if (b.field === "news_ids" || b.field === "idea_ids" || b.field === "contact_ids") {
    patch[b.field] = o[b.field].filter((x) => x !== b.value);
    if (b.field === "idea_ids" && o.shortlisted_idea_id === b.value) patch.shortlisted_idea_id = null;
  } else if (b.field === "source_links") patch.source_links = o.source_links.filter((l) => l.url !== b.value);
  else patch[b.field] = null;
  const updated = await db().update("opportunities", o.id, patch);
  await db().insert("opportunity_activities", { id: newId(), opportunity_id: o.id, kind: "link", body: `Removed ${b.field.replace(/_ids?$/, "").replace("_", " ")} link`, author: user.name, created_at: nowIso() });
  return { opportunity: updated };
});
