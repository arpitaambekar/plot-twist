import type { CampaignIdea, CampaignSet, Claim, Contact, NewsArticle, Opportunity, Pitch, Report } from "@/lib/types";

/**
 * Pitch readiness (spec §12). Every item is either derived from stored data ("auto") or
 * recorded by a person ("manual"). Manual items that nobody has assessed stay "Not assessed";
 * nothing is ever marked complete by default. The percentage is completed / total items.
 */

export type ItemState = "done" | "missing" | "not_assessed";

export interface ReadinessItem {
  key: string;
  label: string;
  kind: "auto" | "manual";
  state: ItemState;
  explanation: string;
  action?: { label: string; href: string };
}

export interface ReadinessGroup {
  key: "A" | "B" | "C" | "D" | "E";
  title: string;
  items: ReadinessItem[];
}

export type ReadinessStatus = "Research Needed" | "Research Ready" | "Outreach Ready" | "Pitch in Development" | "Pitch Ready";

export interface Readiness {
  groups: ReadinessGroup[];
  status: ReadinessStatus;
  status_reason: string;
  completed: number;
  total: number;
  pct: number;
  not_assessed: number;
  next: ReadinessItem | null;
}

export const MANUAL_CRITERIA: Record<string, { label: string; group: ReadinessGroup["key"]; action: string }> = {
  feasibility_reviewed: { label: "Feasibility reviewed", group: "B", action: "Review the shortlisted campaign's feasibility with the team." },
  channels_assessed: { label: "Relevant marketing channels assessed", group: "D", action: "Assess which Scapia channels the campaign would use." },
  inventory_checked: { label: "Travel inventory checked", group: "D", action: "Confirm availability of relevant travel inventory." },
  dependencies_reviewed: { label: "Operational dependencies reviewed", group: "D", action: "Review operational and product dependencies." },
  measurement_defined: { label: "Measurement approach defined", group: "D", action: "Agree how the campaign will be measured." },
  partnership_route: { label: "Potential partnership route identified", group: "E", action: "Identify the likely partnership or procurement route." },
  procurement_investigated: { label: "Budget or procurement status investigated", group: "E", action: "Investigate the board's budget or procurement status." },
};

export interface ReadinessContext {
  report: Report | null;
  reportClaims: Claim[] | null;
  ideas: CampaignIdea[];
  sets: CampaignSet[];
  pitch: Pitch | null;
  contacts: Contact[];
  news: NewsArticle[];
}

const filled = (s: string | null | undefined) => Boolean(s && s.trim().length > 2);

export function computeReadiness(o: Opportunity, ctx: ReadinessContext): Readiness {
  const r = ctx.report;
  const content = r?.content ?? null;
  const dest = encodeURIComponent(o.destination);
  const reportHref = r ? `/research/${r.id}` : `/research?destination=${dest}`;
  const shortlisted =
    ctx.ideas.find((i) => i.id === o.shortlisted_idea_id && (i.status === "shortlisted" || i.status === "approved")) ??
    ctx.ideas.find((i) => i.status === "approved" || i.status === "shortlisted") ??
    null;
  const set = shortlisted ? ctx.sets.find((s) => s.id === shortlisted.set_id) ?? null : null;
  const ideaHref = shortlisted ? `/studio/${shortlisted.set_id}?idea=${shortlisted.id}` : r ? `/studio?report=${r.id}` : "/studio";
  const boardName = o.tourism_board || content?.board_intel.organisation.text || o.destination;
  const contactQuery = `/contacts?q=${encodeURIComponent(`${boardName} India`)}&destination=${dest}`;

  const auto = (key: string, label: string, ok: boolean, yes: string, no: string, action?: { label: string; href: string }): ReadinessItem => ({
    key,
    label,
    kind: "auto",
    state: ok ? "done" : "missing",
    explanation: ok ? yes : no,
    action: ok ? undefined : action,
  });
  const manual = (key: string): ReadinessItem => {
    const def = MANUAL_CRITERIA[key];
    const v = o.manual_checks?.[key];
    return {
      key,
      label: def.label,
      kind: "manual",
      state: v === true ? "done" : v === false ? "missing" : "not_assessed",
      explanation: v === true ? "Confirmed by the team." : v === false ? "Checked by the team: not yet in place." : "Not assessed. This needs a person to confirm it.",
      action: v === true ? undefined : { label: def.action, href: `/opportunities/${o.id}#readiness` },
    };
  };

  // Health is computed from stored claim evidence. Prefer the live claims if supplied.
  const evidencePct = ctx.reportClaims?.length
    ? Math.round((ctx.reportClaims.filter((c) => c.evidence.some((e) => e.quote_found)).length / ctx.reportClaims.length) * 100)
    : (r?.health?.evidence_pct ?? 0);
  const reportUsable = Boolean(r && (r.status === "completed" || r.status === "partial") && content);

  const A: ReadinessGroup = {
    key: "A",
    title: "Destination research",
    items: [
      auto("research_exists", "Research report exists", reportUsable, `Linked report: ${r?.destination_name} v${r?.version} (${r?.status}).`, r ? `Linked report is ${r.status}.` : "No research report is linked.", { label: "Research the destination", href: reportHref }),
      auto(
        "facts_sourced",
        "Important facts sourced",
        reportUsable && evidencePct >= 80,
        `${evidencePct}% of factual claims have evidence found in their sources.`,
        reportUsable ? `Only ${evidencePct}% of factual claims have evidence (threshold 80%).` : "Needs a research report first.",
        { label: "Review the report's unresolved claims", href: reportHref },
      ),
      auto(
        "india_relevance",
        "Indian traveller relevance established",
        Boolean(content?.india_relevance.evidence.some((e) => e.claim_ids.length)),
        "The report includes sourced India-relevance evidence.",
        "No sourced India-relevance evidence in the linked report.",
        { label: "Review India relevance in the report", href: reportHref },
      ),
      auto(
        "board_identified",
        "Tourism board identified",
        filled(o.tourism_board) || filled(content?.board_intel.organisation.text),
        `Tourism board: ${o.tourism_board || content?.board_intel.organisation.text}.`,
        "No tourism board recorded on the opportunity or in the report.",
        { label: "Add the tourism board", href: `/opportunities/${o.id}#details` },
      ),
      auto(
        "marketing_opps",
        "Marketing opportunities documented",
        Boolean(content && (content.campaign_summary.opportunities.length || content.board_intel.recent_campaigns.length)),
        "The report documents marketing opportunities and board activity.",
        "No marketing opportunities documented yet.",
        { label: "Review the report's campaign opportunities", href: reportHref },
      ),
    ],
  };

  const c = shortlisted?.content;
  const B: ReadinessGroup = {
    key: "B",
    title: "Campaign development",
    items: [
      auto("concept_shortlisted", "Campaign concept shortlisted", Boolean(shortlisted), `Shortlisted: ${c?.name}.`, ctx.ideas.length ? "Linked campaigns exist but none is shortlisted." : "No campaign concept is linked.", {
        label: ctx.ideas.length ? "Shortlist a campaign concept" : "Generate campaign ideas",
        href: ctx.ideas[0] ? `/studio/${ctx.ideas[0].set_id}` : r ? `/studio?report=${r.id}` : "/studio",
      }),
      auto("objective_defined", "Objective defined", Boolean(shortlisted && (filled(set?.brief.objective) || filled(c?.board_value))), `Objective: ${set?.brief.objective || "set out in Tourism board value"}.`, shortlisted ? "The shortlisted campaign has no stated objective." : "Needs a shortlisted concept.", {
        label: "Define the campaign objective",
        href: ideaHref,
      }),
      auto("insight_identified", "Destination insight identified", filled(c?.core_insight), "Core insight is written.", shortlisted ? "Core insight is empty." : "Needs a shortlisted concept.", { label: "Sharpen the core insight", href: ideaHref }),
      auto("execution_developed", "Execution developed", filled(c?.how_it_works) && filled(c?.hero_activation), "Mechanic and hero activation are developed.", shortlisted ? "How it works or the hero activation is missing." : "Needs a shortlisted concept.", {
        label: "Develop the shortlisted hero activation",
        href: ideaHref,
      }),
      auto("deliverables_identified", "Core deliverables identified", filled(c?.deliverables), "Deliverables are listed.", shortlisted ? "Deliverables are empty." : "Needs a shortlisted concept.", { label: "List the core deliverables", href: ideaHref }),
      manual("feasibility_reviewed"),
    ],
  };

  const verified = ctx.contacts.filter((x) => (x.status === "Officially Verified" || x.status === "Cross-Verified") && Date.now() - new Date(x.last_verified_at).getTime() < 90 * 86400000);
  const routed = ctx.contacts.filter((x) => x.email || x.phone || x.linkedin || x.website);
  const C: ReadinessGroup = {
    key: "C",
    title: "Contact availability",
    items: [
      auto("contact_found", "Relevant contact found", ctx.contacts.length > 0, `${ctx.contacts.length} contact(s) linked.`, "No contact linked yet.", { label: "Find the tourism board's India contact", href: contactQuery }),
      auto(
        "role_verified",
        "Current professional role verified",
        verified.length > 0,
        `${verified[0]?.full_name} is ${verified[0]?.status.toLowerCase()} (checked within 90 days).`,
        ctx.contacts.length ? "No linked contact is officially or cross-verified within the last 90 days." : "Needs a contact first.",
        { label: "Verify the tourism board's current India representative", href: ctx.contacts[0] ? `/contacts/${ctx.contacts[0].id}` : contactQuery },
      ),
      auto("outreach_route", "Appropriate outreach route identified", routed.length > 0, `Route via ${routed[0]?.email ? "published email" : routed[0]?.phone ? "published phone" : routed[0]?.linkedin ? "LinkedIn" : "official website"}.`, "No published contact route on linked contacts.", {
        label: "Find a published contact route",
        href: ctx.contacts[0] ? `/contacts/${ctx.contacts[0].id}` : contactQuery,
      }),
    ],
  };

  const D: ReadinessGroup = { key: "D", title: "Scapia fit", items: ["channels_assessed", "inventory_checked", "dependencies_reviewed", "measurement_defined"].map(manual) };

  const indiaNews = ctx.news.filter((n) => n.india_relevance !== "Low");
  const boardIndia = content?.board_intel.india_activity.filter((x) => x.claim_ids.length) ?? [];
  const E: ReadinessGroup = {
    key: "E",
    title: "Commercial opportunity",
    items: [
      auto(
        "india_activity",
        "Evidence of India-market activity",
        indiaNews.length > 0 || boardIndia.length > 0,
        indiaNews.length ? `${indiaNews.length} linked India-relevant news item(s).` : "Report documents sourced India-market activity by the board.",
        "No linked news or sourced report evidence of India-market activity.",
        { label: "Link supporting news from Home", href: `/home` },
      ),
      auto("timing", "Relevant timing established", filled(o.campaign_window), `Campaign window: ${o.campaign_window}.`, "No campaign window recorded.", { label: "Set the campaign window", href: `/opportunities/${o.id}#details` }),
      manual("partnership_route"),
      manual("procurement_investigated"),
    ],
  };

  const groups = [A, B, C, D, E];
  const all = groups.flatMap((g) => g.items);
  const completed = all.filter((i) => i.state === "done").length;
  const groupDone = (g: ReadinessGroup) => g.items.every((i) => i.state === "done");
  const has = (k: string) => all.find((i) => i.key === k)?.state === "done";

  let status: ReadinessStatus = "Research Needed";
  let status_reason = "Destination research (A) is incomplete.";
  if (groupDone(A)) {
    status = "Research Ready";
    status_reason = "All destination research criteria are met.";
    if (groupDone(C)) {
      status = "Outreach Ready";
      status_reason = "Research is ready and a verified contact with an outreach route exists.";
      if (has("concept_shortlisted")) {
        status = "Pitch in Development";
        status_reason = "A concept is shortlisted; remaining campaign, fit and commercial checks are open.";
        if (all.every((i) => i.state === "done")) {
          status = "Pitch Ready";
          status_reason = "Every criterion is complete.";
        }
      }
    }
  }

  // Most relevant missing action: research first, then contact, campaign, commercial, fit.
  const order = [A, C, B, E, D];
  const next = order.flatMap((g) => g.items).find((i) => i.state !== "done") ?? null;

  return {
    groups,
    status,
    status_reason,
    completed,
    total: all.length,
    pct: Math.round((completed / all.length) * 100),
    not_assessed: all.filter((i) => i.state === "not_assessed").length,
    next,
  };
}
