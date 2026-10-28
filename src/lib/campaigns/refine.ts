import "server-only";
import { generateStructured } from "@/lib/ai/openai";
import { db, newId, nowIso } from "@/lib/db";
import type { CampaignIdea, CampaignSet, Comparison } from "@/lib/types";
import { CAMPAIGN_FIELDS } from "@/lib/types";
import { CombineOutput, CompareOutput, COMPARE_CRITERIA, RefineOutput, outputOf } from "./schemas";
import { CREATIVE_SYSTEM } from "./generate";
import { briefText, contextForSet, resolveRefs } from "./context";
import { EDITABLE_FIELDS, createIdea, toContent } from "./service";
import { demoCombine, demoCompare, demoRefine } from "@/lib/fixtures/campaigns";
import { findPhoto } from "@/lib/images";

export const REFINE_ACTIONS = {
  bolder: { label: "Make It Bolder", instruction: "Increase creative originality and surprise while keeping it feasible and safe.", fields: ["big_idea", "line", "how_it_works", "hero_activation", "creator_opportunities"] },
  realistic: { label: "Make It More Realistic", instruction: "Simplify the concept for practical execution: fewer moving parts, clearer operations, lower production complexity.", fields: ["how_it_works", "hero_activation", "deliverables", "feasibility", "budget_tier", "risks"] },
  destination: { label: "Make It More Destination-Specific", instruction: "Strengthen local cultural, geographic and experiential detail using the research. Remove anything that could apply to any destination.", fields: ["core_insight", "why_destination", "big_idea", "how_it_works", "hero_activation"] },
  scapia: { label: "Make It More Scapia-Focused", instruction: "Improve the relevant marketing integrations and the travel-planning journey on Scapia. Label anything needing new product development.", fields: ["scapia_integration", "user_journey", "success_metrics", "deliverables"] },
  name: { label: "Improve the Campaign Name", instruction: "Write a stronger, more ownable campaign name and line. Avoid clichés.", fields: ["name", "line"] },
  hero: { label: "Strengthen the Hero Idea", instruction: "Develop a more memorable, PR-worthy centrepiece moment that is still safe and executable.", fields: ["hero_activation"] },
  conversion: { label: "Improve the Conversion Journey", instruction: "Make the path from awareness to trip planning clearer, with specific steps and measurable hand-offs.", fields: ["user_journey", "scapia_integration", "success_metrics"] },
  custom: { label: "Custom Refinement", instruction: "", fields: [] as string[] },
} as const;
export type RefineAction = keyof typeof REFINE_ACTIONS;

const LABEL = Object.fromEntries([...CAMPAIGN_FIELDS, ["summary", "Summary"], ["research_notes", "Research notes"]]) as Record<string, string>;

export interface RefinePreview {
  action: RefineAction;
  label: string;
  changes: { field: string; label: string; before: string; after: string; reason: string }[];
  skipped_locked: { field: string; label: string; after: string }[];
  note: string;
}

/**
 * Produce a refinement preview. Only the action's target fields may change (custom: any editable field).
 * Fields the team edited by hand are held back unless allowOverwrite is true.
 */
export async function previewRefinement(idea: CampaignIdea, set: CampaignSet, action: RefineAction, instruction: string, allowOverwrite: boolean, userId: string): Promise<RefinePreview> {
  const spec = REFINE_ACTIONS[action];
  const targets = action === "custom" ? EDITABLE_FIELDS : [...spec.fields];
  const { ctx } = await contextForSet(set, idea.report_version);
  const out = await generateStructured({
    task: `campaign.refine.${action}`,
    schema: outputOf(RefineOutput),
    creative: true,
    userId,
    maxTokens: 12000,
    system: CREATIVE_SYSTEM,
    user: [
      `Refine this ${idea.destination} campaign concept. Task: ${action === "custom" ? instruction : spec.instruction}`,
      action === "custom" ? `Change only the fields needed for the instruction. Allowed fields: ${targets.join(", ")}.` : `Change ONLY these fields: ${targets.join(", ")}. Leave everything else untouched.`,
      !allowOverwrite && idea.locked_fields.length ? `These fields were edited by hand; do not change them: ${idea.locked_fields.join(", ")}.` : "",
      `CURRENT CONCEPT:\n${JSON.stringify(idea.content).slice(0, 9000)}`,
      `RESEARCH (${ctx.basis}):\n${ctx.text.slice(0, 18000)}`,
      'Return {"changes": [{"field": "<field name>", "value": "<full new text>", "reason": "<why>"}], "note": "<one-line summary>"}.',
    ]
      .filter(Boolean)
      .join("\n\n"),
    fixture: () => demoRefine(targets.filter((f) => action !== "custom" || ["big_idea", "how_it_works"].includes(f)), spec.label),
  });
  const current = idea.content as unknown as Record<string, unknown>;
  const changes: RefinePreview["changes"] = [];
  const skipped: RefinePreview["skipped_locked"] = [];
  for (const c of out.changes) {
    if (!targets.includes(c.field) || typeof c.value !== "string" || !c.value.trim()) continue;
    const before = String(current[c.field] ?? "");
    if (before === c.value) continue;
    if (idea.locked_fields.includes(c.field) && !allowOverwrite) {
      skipped.push({ field: c.field, label: LABEL[c.field] ?? c.field, after: c.value });
      continue;
    }
    changes.push({ field: c.field, label: LABEL[c.field] ?? c.field, before, after: c.value, reason: c.reason });
  }
  // Locked targets the model respected still need to be surfaced, so the user knows why they didn't change.
  for (const f of targets) {
    if (idea.locked_fields.includes(f) && !allowOverwrite && !skipped.some((s) => s.field === f) && action !== "custom") skipped.push({ field: f, label: LABEL[f] ?? f, after: "" });
  }
  return { action, label: spec.label, changes, skipped_locked: skipped, note: out.note };
}

export async function compareIdeas(ideas: CampaignIdea[], userId: string, createdBy: string): Promise<Comparison> {
  const refs = ideas.map((_, i) => `I${i + 1}`);
  const out = await generateStructured({
    task: "campaign.compare",
    schema: outputOf(CompareOutput),
    userId,
    maxTokens: 12000,
    system:
      "You are a candid creative-strategy reviewer. Score each campaign concept 1 (weak) to 5 (strong) on each criterion with a one-sentence rationale. " +
      "For 'Production complexity', 5 means LOW complexity (easier to produce). These are subjective assessments; do not present them as facts.",
    user: [
      `Criteria: ${COMPARE_CRITERIA.join(", ")}.`,
      ...ideas.map((idea, i) => `${refs[i]}: ${JSON.stringify(idea.content).slice(0, 5000)}`),
      'Return {"ideas":[{"ref":"I1","scores":[{"criterion":"Originality","score":4,"rationale":"..."}],"summary":"..."}],"verdict":"..."}.',
    ].join("\n\n"),
    fixture: () => demoCompare(refs),
  });
  const comparison: Comparison = {
    id: newId("cmp_"),
    idea_ids: ideas.map((i) => i.id),
    criteria: [...COMPARE_CRITERIA],
    scores: ideas.map((idea, i) => {
      const row = out.ideas.find((x) => x.ref === refs[i]) ?? out.ideas[i];
      const scores: Comparison["scores"][number]["scores"] = {};
      for (const c of COMPARE_CRITERIA) {
        const s = row?.scores.find((x) => x.criterion.toLowerCase() === c.toLowerCase());
        if (s) scores[c] = { score: Math.round(s.score), rationale: s.rationale };
      }
      return { idea_id: idea.id, scores, summary: row?.summary ?? "" };
    }),
    verdict: out.verdict,
    created_by: createdBy,
    created_at: nowIso(),
  };
  await db().insert("comparisons", comparison);
  return comparison;
}

/** Combine two concepts into a new idea. Originals are untouched. */
export async function combineIdeas(a: CampaignIdea, b: CampaignIdea, set: CampaignSet, user: { id: string; name: string }): Promise<CampaignIdea> {
  const { ctx, loaded } = await contextForSet(set, a.report_version ?? b.report_version);
  const out = await generateStructured({
    task: "campaign.combine",
    schema: outputOf(CombineOutput),
    creative: true,
    userId: user.id,
    maxTokens: 16000,
    system: CREATIVE_SYSTEM,
    user: [
      `Combine these two ${a.destination} concepts into ONE coherent, stronger campaign (not a stapled-together list). Explain what was retained, removed, how they were merged, why the result is stronger, and feasibility implications.`,
      `CONCEPT A:\n${JSON.stringify(a.content).slice(0, 7000)}`,
      `CONCEPT B:\n${JSON.stringify(b.content).slice(0, 7000)}`,
      briefText(set.brief),
      `RESEARCH (${ctx.basis}):\n${ctx.text.slice(0, 16000)}`,
      'Return {"idea": {...all idea fields...}, "merge": {"retained","removed","how_merged","why_stronger","feasibility"}}.',
    ].join("\n\n"),
    fixture: () => demoCombine(a.content as unknown as Record<string, unknown>, b.content as unknown as Record<string, unknown>, a.destination),
  });
  const m = out.merge;
  const notes = `Retained: ${m.retained}\nRemoved: ${m.removed}\nHow merged: ${m.how_merged}\nWhy stronger: ${m.why_stronger}\nFeasibility: ${m.feasibility}`;
  const claimIds = [...new Set([...resolveRefs(out.idea.research_refs, ctx.labels), ...a.content.research_claim_ids, ...b.content.research_claim_ids])];
  const image = a.image ?? b.image ?? (await findPhoto(a.destination).catch(() => null));
  return createIdea({
    set_id: a.set_id,
    destination: a.destination,
    content: toContent(out.idea, claimIds),
    report_id: a.report_id ?? b.report_id,
    report_version: loaded?.version ?? a.report_version,
    origin: "combined",
    parent_ids: [a.id, b.id],
    merge_notes: notes,
    image,
    author: user,
    is_demo: a.is_demo || b.is_demo,
    action: `Combined from "${a.content.name}" and "${b.content.name}"`,
  });
}
