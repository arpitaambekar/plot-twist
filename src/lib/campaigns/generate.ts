import "server-only";
import { db, nowIso } from "@/lib/db";
import { generateStructured } from "@/lib/ai/openai";
import { findPhoto } from "@/lib/images";
import { setJobStage } from "@/lib/jobs";
import { env } from "@/lib/env";
import type { CampaignIdea, CampaignSet, ResearchJob } from "@/lib/types";
import { AiIdea, CAPABILITY_LIBRARY, Extras, IdeaBatch, BANNED_TITLES, outputOf } from "./schemas";
import { briefText, contextForSet, resolveRefs, type ResearchContext } from "./context";
import { applyChanges, createIdea, isBannedTitle, normName, toContent } from "./service";
import { demoExtras, demoIdeaBatch } from "@/lib/fixtures/campaigns";
import { z } from "zod";

export const CREATIVE_SYSTEM = `You are a senior creative strategist and tourism-marketing creative director developing campaigns that a tourism board would co-fund with Scapia, an Indian travel platform (flights, stays, experiences, a travel credit card with rewards).
Every concept must combine: a destination-specific insight + Indian-traveller relevance + a surprising creative mechanic + clear execution + a practical travel-planning connection.
Rules:
- Ground insights in the research provided. Reference the fact labels (F1, F2…) that informed each idea in research_refs. Never invent statistics, quotes, partnerships, prices or board objectives; if the board's objective is not documented, say "board objective not documented; hypothesis:" before your assumption.
- Strategic interpretation and creative hypothesis are fine and expected, but never present them as fact.
- Banned titles and phrases: ${BANNED_TITLES.map((t) => `"${t}"`).join(", ")}, and similar clichés. Titles must be memorable, specific and ownable.
- Do not copy protected titles or distinctive executions of existing tourism campaigns.
- No legally questionable, unsafe or operationally implausible stunts. Flag permits, safety, licensing and seasonality in risks.
- Budget tier is relative production complexity (Lean / Mid-scale / Premium / Hero activation), never a monetary quote.
- Feasibility should start with "High", "Medium" or "Low" followed by a short reason covering technical, operational and creative complexity.
- how_it_works and user_journey should be clear numbered steps on separate lines.
- success_metrics should cover awareness, engagement, consideration and conversion KPIs as relevant (no invented targets).
- channels is a comma-separated list.
${CAPABILITY_LIBRARY}`;

const BATCH_FOCUS = [
  "Batch A focus (pick what fits the research and brief): interactive or gamified discovery, personality-led formats, creator participation, cultural marketing, regional tourism dispersal.",
  "Batch B focus (pick what fits the research and brief): seasonal or shoulder-season travel, travel-planning challenges, a PR-worthy hero idea, in-app conversion-led journeys, long-form storytelling, digital or experiential activations.",
];

async function generateBatch(ctx: ResearchContext, briefTxt: string, batch: number, avoid: string[], userId: string, feedback = ""): Promise<AiIdea[]> {
  const labels = [...ctx.labels.keys()];
  const out = await generateStructured({
    task: "campaign.generate_batch",
    schema: outputOf(IdeaBatch),
    creative: true,
    userId,
    maxTokens: 32000,
    system: CREATIVE_SYSTEM,
    user: [
      `Create exactly 5 genuinely different campaign concepts for ${ctx.destination}. They must not be variations of one idea: vary the mechanic, the audience, the channel mix and the emotional register.`,
      BATCH_FOCUS[batch] ?? "",
      avoid.length ? `Already created (do not repeat these names, mechanics or territories): ${avoid.join(" | ")}` : "",
      feedback,
      briefTxt,
      ctx.hasEvidence ? "" : "Note: no verified fact library is attached. Leave research_refs empty and explain in research_notes what the idea rests on.",
      `RESEARCH (${ctx.basis}):\n${ctx.text}`,
      'Return {"ideas": [5 objects]}. Each needs every field in the schema, including photo_subject: a specific real place or scene from the research that would illustrate the idea.',
    ]
      .filter(Boolean)
      .join("\n\n"),
    fixture: () => demoIdeaBatch(ctx.destination, batch, labels),
  });
  return out.ideas.slice(0, 5);
}

/** Exactly ten distinct ideas, built in two batches with an avoid-list and quality checks. */
export async function generateTen(ctx: ResearchContext, briefTxt: string, userId: string, log: (m: string) => Promise<void>): Promise<AiIdea[]> {
  const ideas: AiIdea[] = [];
  for (let batch = 0; batch < 2; batch++) {
    await log(`Developing concepts ${batch * 5 + 1}–${batch * 5 + 5}`);
    let feedback = "";
    for (let attempt = 0; attempt < 3 && ideas.length < (batch + 1) * 5; attempt++) {
      const got = await generateBatch(
        ctx,
        briefTxt,
        batch,
        ideas.map((i) => `${i.name} (${i.campaign_type})`),
        userId,
        feedback,
      );
      const rejected: string[] = [];
      for (const g of got) {
        if (ideas.length >= (batch + 1) * 5) break;
        if (isBannedTitle(g.name)) rejected.push(`"${g.name}" uses a banned cliché`);
        else if (ideas.some((i) => normName(i.name) === normName(g.name))) rejected.push(`"${g.name}" duplicates an existing name`);
        else ideas.push(g);
      }
      if (rejected.length) feedback = `Some concepts were rejected: ${rejected.join("; ")}. Replace them with new, different concepts.`;
    }
  }
  if (ideas.length < 10) throw new Error(`Only ${ideas.length} distinct concepts passed quality checks. Please retry.`);
  return ideas.slice(0, 10);
}

export async function generateExtras(ctx: ResearchContext, briefTxt: string, ideaNames: string[], userId: string) {
  return generateStructured({
    task: "campaign.extras",
    schema: outputOf(Extras),
    creative: true,
    userId,
    maxTokens: 32000,
    system: CREATIVE_SYSTEM,
    user: [
      `For ${ctx.destination}, create the four additional outputs. They should complement (not repeat) these main concepts: ${ideaNames.join(" | ")}.`,
      "A. in_app: 8 to 10 in-app marketing ideas, each with a specific concept (no generic banners): placement, audience, hook, interaction, message, experience featured, intended next action, measurement.",
      "B. short_form: exactly 5 recurring short-form series for Instagram Reels / YouTube Shorts, each with exactly 3 example episodes.",
      "C. long_form: exactly 3 long-form series that feel different from conventional destination vlogs.",
      "D. hero_ideas: exactly 3 crazy-but-realistic hero ideas bold enough for PR; at least one must be digital_only (no large physical event). No unsafe, illegal or implausible stunts.",
      briefTxt,
      `RESEARCH (${ctx.basis}):\n${ctx.text}`,
    ].join("\n\n"),
    fixture: () => demoExtras(ctx.destination),
  });
}

async function photoFor(subject: string, destination: string) {
  const q = subject && !subject.includes("[DEMO]") ? `${subject} ${destination}` : destination;
  return (await findPhoto(q, { alt: subject || destination })) ?? (await findPhoto(destination, { alt: destination }));
}

/** Job handler: generates the ten concepts and the four extra sections for a campaign set. */
export async function runCampaignJob(job: ResearchJob): Promise<void> {
  const setId = String(job.input.set_id ?? "");
  const store = db();
  const set = await store.get("campaign_sets", setId);
  if (!set) throw new Error("Campaign set not found");
  const author = { id: set.created_by, name: String(job.input.author_name ?? "plot twist.") };
  try {
    await setJobStage(job.id, "extracting_facts", "Reading the research");
    const { ctx, loaded } = await contextForSet(set);
    const bt = briefText(set.brief);
    const log = (m: string) => setJobStage(job.id, "generating_report", m);

    const existing = await store.list("campaign_ideas", { where: { set_id: set.id } as never });
    let ideasCreated: CampaignIdea[] = existing;
    if (!existing.length) {
      const ten = await generateTen(ctx, bt, set.created_by, log);
      await log("Checking concepts against the research");
      const images = await Promise.all(ten.map((t) => photoFor(t.photo_subject, set.destination).catch(() => null)));
      ideasCreated = [];
      for (let i = 0; i < ten.length; i++) {
        ideasCreated.push(
          await createIdea({
            set_id: set.id,
            destination: set.destination,
            content: toContent(ten[i], resolveRefs(ten[i].research_refs, ctx.labels)),
            report_id: set.report_id,
            report_version: loaded?.version ?? null,
            origin: "generated",
            image: images[i],
            author,
            is_demo: set.is_demo,
            action: "Generated",
          }),
        );
      }
    }

    await log("Creating in-app, short-form, long-form and hero ideas");
    let extrasError: string | null = null;
    try {
      const extras = await generateExtras(ctx, bt, ideasCreated.map((i) => i.content.name), set.created_by);
      await store.update("campaign_sets", set.id, { extras, updated_at: nowIso() });
    } catch (e) {
      extrasError = `Additional outputs could not be generated: ${(e as Error).message}`;
    }
    await store.update("campaign_sets", set.id, { status: "ready", error: extrasError, updated_at: nowIso() });
    await setJobStage(job.id, "completed", extrasError ? "Completed with partial results" : "Completed", { result_id: set.id });
  } catch (e) {
    await store.update("campaign_sets", set.id, { status: "failed", error: (e as Error).message, updated_at: nowIso() });
    throw e;
  }
}

/**
 * Regenerate one idea. Fields the team edited by hand (locked) are held fixed and passed
 * to the model as constraints; only unlocked fields are replaced. A new revision is recorded.
 */
export async function regenerateIdea(idea: CampaignIdea, set: CampaignSet, user: { id: string; name: string }, version?: number | null): Promise<CampaignIdea> {
  const { ctx, loaded } = await contextForSet(set, version ?? idea.report_version);
  const locked = Object.fromEntries(idea.locked_fields.map((f) => [f, (idea.content as unknown as Record<string, unknown>)[f]]));
  const out = await generateStructured({
    task: "campaign.regenerate",
    schema: outputOf(z.object({ idea: AiIdea })),
    creative: true,
    userId: user.id,
    maxTokens: 16000,
    system: CREATIVE_SYSTEM,
    user: [
      `Regenerate this ${ctx.destination} campaign concept with a fresh, stronger take on the same territory. Keep it distinct from its current version.`,
      `CURRENT CONCEPT:\n${JSON.stringify(idea.content).slice(0, 8000)}`,
      Object.keys(locked).length
        ? `These fields were edited by the team and MUST stay exactly as they are; build the rest around them:\n${JSON.stringify(locked)}`
        : "",
      briefText(set.brief),
      `RESEARCH (${ctx.basis}):\n${ctx.text}`,
      'Return {"idea": {...}}.',
    ]
      .filter(Boolean)
      .join("\n\n"),
    fixture: () => ({ idea: { ...demoIdeaBatch(ctx.destination, 0, [...ctx.labels.keys()]).ideas[0], name: `${idea.content.name} (regenerated)` } }),
  });
  const fresh = toContent(out.idea, resolveRefs(out.idea.research_refs, ctx.labels));
  const changes: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fresh)) if (!idea.locked_fields.includes(k)) changes[k] = v;
  return applyChanges(idea, changes, {
    manual: false,
    action: loaded && loaded.version !== idea.report_version ? `Regenerated with research v${loaded.version}` : "Regenerated",
    author: user.name,
    extra: { report_version: loaded?.version ?? idea.report_version, origin: idea.origin === "generated" ? "regenerated" : idea.origin },
  });
}

export function aiConfigured() {
  return Boolean(env.openaiKey) || env.demoFixtures;
}
