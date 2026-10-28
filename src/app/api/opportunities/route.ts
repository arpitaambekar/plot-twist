import { z } from "zod";
import { route, parseBody } from "@/lib/api";
import { db, newId, nowIso } from "@/lib/db";
import { OpportunityLinks } from "@/lib/opportunities/links";
import { audit } from "@/lib/audit";
import { STAGES, type Opportunity } from "@/lib/types";
import { safeUrl } from "@/lib/security/content";

const Create = OpportunityLinks.extend({
  name: z.string().min(2).max(200),
  destination: z.string().min(1).max(120),
  tourism_board: z.string().max(200).nullable().optional(),
  summary: z.string().max(4000).default(""),
  priority: z.enum(["High", "Medium", "Low"]).default("Medium"),
  stage: z.enum(STAGES).default("Identified"),
  owner: z.string().max(120).nullable().optional(),
});

export const GET = route("viewer", async () => {
  const items = await db().list("opportunities", { orderBy: { column: "updated_at" } });
  return { items };
});

export const POST = route("editor", async ({ user, req }) => {
  const b = await parseBody(req, Create);
  const opp: Opportunity = {
    id: newId("opp_"),
    name: b.name,
    destination: b.destination,
    tourism_board: b.tourism_board ?? null,
    summary: b.summary,
    stage: b.stage,
    priority: b.priority,
    owner: b.owner ?? user.name,
    next_action: null,
    next_action_date: null,
    last_interaction: null,
    campaign_window: null,
    commercial_notes: null,
    notes: "",
    news_ids: b.news_ids ?? [],
    report_id: b.report_id ?? null,
    idea_ids: b.idea_ids ?? [],
    shortlisted_idea_id: b.shortlisted_idea_id ?? null,
    pitch_id: b.pitch_id ?? null,
    contact_ids: b.contact_ids ?? [],
    source_links: (b.source_links ?? []).filter((l) => safeUrl(l.url)),
    manual_checks: {},
    created_by: user.id,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await db().insert("opportunities", opp);
  await db().insert("opportunity_activities", { id: newId(), opportunity_id: opp.id, kind: "created", body: `Opportunity created by ${user.name}`, author: user.name, created_at: nowIso() });
  await audit(user.email, "opportunity.create", opp.id);
  return { opportunity: opp };
});
