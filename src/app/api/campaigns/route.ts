import { z } from "zod";
import { route, parseBody, HttpError } from "@/lib/api";
import { db, newId, nowIso } from "@/lib/db";
import { burstLimit } from "@/lib/security/rate-limit";
import { sanitizeExternalText } from "@/lib/security/content";
import { NotConfiguredError, env } from "@/lib/env";
import { audit } from "@/lib/audit";
import type { CampaignSet } from "@/lib/types";
import { startSetJob } from "@/lib/campaigns/jobs";
import { BUDGET_TIERS, AMBITIONS } from "@/lib/campaigns/schemas";

const s = (max: number) => z.string().max(max).optional();
const Brief = z.object({
  destination: z.string().max(120).default(""),
  tourism_board: s(200),
  objective: s(200),
  audience: s(600),
  season: s(200),
  budget_tier: z.enum([...BUDGET_TIERS, ""]).optional(),
  duration: s(120),
  focus_areas: s(800),
  channels: z.array(z.string().max(60)).max(12).optional(),
  positioning: s(800),
  ambition: z.enum([...AMBITIONS, ""]).optional(),
  inspiration_reference_id: z.string().max(200).optional(),
});

const Create = z.object({
  input_mode: z.enum(["report", "upload", "paste"]),
  report_id: z.string().max(200).optional(),
  supplied_research: z.string().max(120000).optional(),
  supplied_filename: z.string().max(200).optional(),
  brief: Brief,
});

export const GET = route("viewer", async () => {
  const sets = await db().list("campaign_sets", { orderBy: { column: "created_at" }, limit: 100 });
  const ideas = await db().list("campaign_ideas", { orderBy: { column: "updated_at" }, limit: 2000 });
  return {
    sets: sets.map((set) => {
      const mine = ideas.filter((i) => i.set_id === set.id);
      return { ...set, supplied_research: null, idea_count: mine.length, shortlisted: mine.filter((i) => i.status === "shortlisted" || i.status === "approved").length, cover: mine.find((i) => i.image)?.image ?? null };
    }),
  };
});

export const POST = route("editor", async ({ user, req }) => {
  burstLimit(`campaign:${user.id}`, 4, 2);
  const b = await parseBody(req, Create);
  if (!env.openaiKey && !env.demoFixtures) throw new NotConfiguredError("ai", "Campaign generation needs OPENAI_API_KEY.");

  let destination = b.brief.destination.trim();
  let reportVersion: number | null = null;
  let isDemo = env.demoFixtures;
  let supplied: string | null = null;

  if (b.input_mode === "report") {
    const report = b.report_id ? await db().get("reports", b.report_id) : null;
    if (!report) throw new HttpError(400, "Choose a destination report to build from.");
    if (!report.content || report.status === "generating" || report.status === "failed") throw new HttpError(400, "That report has no completed content yet.");
    destination = destination || report.destination_name;
    reportVersion = report.version;
    isDemo = isDemo || report.is_demo;
  } else {
    supplied = sanitizeExternalText(b.supplied_research ?? "", 60000);
    if (supplied.length < 200) throw new HttpError(400, "Add at least a few paragraphs of research (200+ characters) so ideas have something real to build on.");
    if (!destination) throw new HttpError(400, "Tell us which destination this research is about.");
  }

  let inspiration: CampaignSet["brief"]["inspiration"] = null;
  if (b.brief.inspiration_reference_id) {
    const ref = await db().get("reference_campaigns", b.brief.inspiration_reference_id);
    if (ref) inspiration = { reference_id: ref.id, name: ref.name, mechanism: `${ref.creative_idea} Participation: ${ref.participation_mechanism}`, learning: ref.strategic_learning };
  }

  // Duplicate-request detection: same input from the same person in the last 10 minutes.
  const { inspiration_reference_id: _ir, ...briefRest } = b.brief;
  void _ir;
  const brief = { ...briefRest, destination, inspiration };
  const recent = await db().list("campaign_sets", { where: { created_by: user.id } as never, orderBy: { column: "created_at" }, limit: 5 });
  const dup = recent.find(
    (r) =>
      Date.now() - new Date(r.created_at).getTime() < 10 * 60 * 1000 &&
      r.input_mode === b.input_mode &&
      r.report_id === (b.report_id ?? null) &&
      r.report_version === reportVersion &&
      JSON.stringify(r.brief) === JSON.stringify(brief) &&
      r.status !== "failed",
  );
  if (dup) return { set: dup, duplicate: true };

  const set: CampaignSet = {
    id: newId("cs_"),
    title: `${destination}${b.brief.objective ? `: ${b.brief.objective}` : " campaign ideas"}`,
    destination,
    report_id: b.input_mode === "report" ? (b.report_id ?? null) : null,
    report_version: reportVersion,
    input_mode: b.input_mode,
    supplied_research: supplied,
    supplied_filename: b.supplied_filename ?? null,
    brief,
    extras: null,
    status: "generating",
    error: null,
    created_by: user.id,
    created_at: nowIso(),
    updated_at: nowIso(),
    is_demo: isDemo,
  };
  await db().insert("campaign_sets", set);
  await startSetJob(set.id, user);
  await audit(user.email, "campaign.generate", set.id, { destination, mode: b.input_mode });
  return { set };
});
