import "server-only";
import { generateStructured } from "@/lib/ai/openai";
import { db, newId, nowIso } from "@/lib/db";
import type { CampaignIdea, CampaignSet, Claim, Pitch, PitchSectionKey, SourceRecord } from "@/lib/types";
import { PitchOutput, outputOf } from "./schemas";
import { CREATIVE_SYSTEM } from "./generate";
import { briefText, contextForSet } from "./context";
import { demoPitch } from "@/lib/fixtures/campaigns";

/** Claims and sources behind an idea (from the exact report version it was built on). */
export async function researchBehind(idea: CampaignIdea): Promise<{ claims: Claim[]; sources: SourceRecord[] }> {
  const ids = idea.content.research_claim_ids ?? [];
  if (!ids.length) return { claims: [], sources: [] };
  const claims = await db().list("claims", { in: { column: "id", values: ids } });
  const sids = [...new Set(claims.flatMap((c) => c.evidence.map((e) => e.source_id)))];
  const sources = sids.length ? await db().list("sources", { in: { column: "id", values: sids } }) : [];
  return { claims, sources };
}

/**
 * Supporting research is assembled from stored claims and sources, never written by the model,
 * so the pitch cannot carry invented citations.
 */
export function supportingResearchText(claims: Claim[], sources: SourceRecord[], basis: string): string {
  if (!claims.length) return `${basis}. No verified research claims are linked to this concept yet. Review the source research before pitching.`;
  const num = new Map(sources.map((s, i) => [s.id, i + 1]));
  const lines = claims.map((c) => {
    const n = [...new Set(c.evidence.filter((e) => e.quote_found).map((e) => num.get(e.source_id)).filter(Boolean))];
    return `• ${c.text} (${c.status}${n.length ? `; sources ${n.map((x) => `[${x}]`).join("")}` : ""})`;
  });
  const src = sources.map((s, i) => `[${i + 1}] ${s.title}, ${s.publisher}. ${s.url}`);
  return `${basis}.\n\n${lines.join("\n")}\n\nSources:\n${src.join("\n")}`;
}

export async function developPitch(idea: CampaignIdea, set: CampaignSet, user: { id: string; name: string }): Promise<Pitch> {
  const { ctx } = await contextForSet(set, idea.report_version);
  const { claims, sources } = await researchBehind(idea);
  const extras = set.extras;
  const out = await generateStructured({
    task: "campaign.pitch",
    schema: outputOf(PitchOutput),
    creative: true,
    userId: user.id,
    maxTokens: 24000,
    system:
      CREATIVE_SYSTEM +
      "\nYou are now writing a partnership pitch document for a tourism board. Lead with the opportunity and the decision you want. Keep facts strictly to the research; label hypotheses. The timeline is a suggested phasing, not a commitment.",
    user: [
      `Develop this shortlisted ${idea.destination} concept into a full pitch with these sections: destination_opportunity, marketing_objective, traveller_insight (Indian traveller insight), positioning, big_idea, narrative, hero_activation, in_app, creator_strategy, social_formats, long_form, participation, user_journey, channel_plan, deliverables, timeline, measurement, feasibility, dependencies. Use short paragraphs and bullet-style lines starting with "• " where helpful.`,
      `CONCEPT:\n${JSON.stringify(idea.content).slice(0, 9000)}`,
      extras ? `SUPPORTING STUDIO OUTPUTS (reuse where relevant):\n${JSON.stringify({ in_app: extras.in_app.slice(0, 4), short_form: extras.short_form.slice(0, 2), long_form: extras.long_form.slice(0, 1) }).slice(0, 6000)}` : "",
      briefText(set.brief),
      `RESEARCH (${ctx.basis}):\n${ctx.text.slice(0, 16000)}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    fixture: () => demoPitch(idea.content.name),
  });
  const sections = { ...out.sections, supporting_research: supportingResearchText(claims, sources, ctx.basis) } as Record<PitchSectionKey, string>;
  const pitch: Pitch = {
    id: newId("pitch_"),
    idea_id: idea.id,
    title: out.title || `${idea.content.name}: partnership pitch`,
    destination: idea.destination,
    sections,
    source_ids: sources.map((s) => s.id),
    version: 1,
    created_by: user.id,
    created_at: nowIso(),
    updated_at: nowIso(),
    is_demo: idea.is_demo,
  };
  await db().insert("pitches", pitch);
  return pitch;
}
