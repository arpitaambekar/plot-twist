import { route, parseBody, notFound } from "@/lib/api";
import { db, newId, nowIso } from "@/lib/db";
import { OpportunityLinks } from "@/lib/opportunities/links";
import { safeUrl } from "@/lib/security/content";

const uniq = (a: string[]) => [...new Set(a)];

/** Attach more evidence/work to an existing opportunity without re-entering anything. */
export const POST = route<{ id: string }>("editor", async ({ user, params, req }) => {
  const b = await parseBody(req, OpportunityLinks);
  const o = await db().get("opportunities", params.id);
  if (!o) throw notFound("Opportunity");
  const patch = {
    news_ids: uniq([...o.news_ids, ...(b.news_ids ?? [])]),
    idea_ids: uniq([...o.idea_ids, ...(b.idea_ids ?? []), ...(b.shortlisted_idea_id ? [b.shortlisted_idea_id] : [])]),
    contact_ids: uniq([...o.contact_ids, ...(b.contact_ids ?? [])]),
    report_id: b.report_id ?? o.report_id,
    shortlisted_idea_id: b.shortlisted_idea_id ?? o.shortlisted_idea_id,
    pitch_id: b.pitch_id ?? o.pitch_id,
    source_links: [...o.source_links, ...(b.source_links ?? []).filter((l) => safeUrl(l.url) && !o.source_links.some((x) => x.url === l.url))],
    updated_at: nowIso(),
  };
  const updated = await db().update("opportunities", o.id, patch);
  const what = Object.entries(b)
    .filter(([, v]) => v && (!Array.isArray(v) || v.length))
    .map(([k]) => k.replace(/_ids?$/, "").replace("_", " "))
    .join(", ");
  await db().insert("opportunity_activities", { id: newId(), opportunity_id: o.id, kind: "link", body: `Linked ${what}`, author: user.name, created_at: nowIso() });
  return { opportunity: updated };
});
