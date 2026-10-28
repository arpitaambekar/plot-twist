import "server-only";
import { db } from "@/lib/db";
import type { CampaignBrief, CampaignSet, Claim, Report, ReportContent, SourceRecord, SourcedText } from "@/lib/types";
import { asUntrustedBlock } from "@/lib/security/content";

export interface LoadedReport {
  report: Report;
  content: ReportContent | null;
  version: number;
  claims: Claim[];
  sources: SourceRecord[];
}

/** Load a report at an exact version, with the claims and sources belonging to that version. */
export async function loadReportVersion(reportId: string, version?: number | null): Promise<LoadedReport | null> {
  const store = db();
  const report = await store.get("reports", reportId);
  if (!report) return null;
  let content = report.content;
  let v = report.version;
  let sourceIds = report.source_ids ?? [];
  if (version && version !== report.version) {
    const rv = (await store.list("report_versions", { where: { report_id: reportId, version } as never, limit: 1 }))[0];
    if (rv) {
      content = rv.content;
      v = rv.version;
      sourceIds = rv.source_ids ?? [];
    }
  }
  let claims = await store.list("claims", { where: { subject_type: "report", subject_id: `${reportId}:v${v}` } as never });
  if (!claims.length) claims = await store.list("claims", { where: { subject_type: "report", subject_id: reportId } as never });
  const ids = new Set([...sourceIds, ...claims.flatMap((c) => c.evidence.map((e) => e.source_id))]);
  const sources = ids.size ? await store.list("sources", { in: { column: "id", values: [...ids] } }) : [];
  return { report, content, version: v, claims, sources };
}

export interface ResearchContext {
  destination: string;
  /** Prompt text, structured. */
  text: string;
  /** Fact label (F1…) → claim id. */
  labels: Map<string, string>;
  hasEvidence: boolean;
  /** Short descriptor for UI and prompts. */
  basis: string;
}

const MAX_FACTS = 90;

/**
 * Structured research transfer (spec §15): destination identity, verified facts with ids,
 * Indian traveller insight, popular vs under-promoted, culture, board activity, seasonality and constraints.
 * Facts are labelled F1…Fn so the model can only reference what was actually researched.
 */
export function buildReportContext(loaded: LoadedReport): ResearchContext {
  const { report, content, claims } = loaded;
  const usable = claims.filter((c) => c.status !== "Unverified").slice(0, MAX_FACTS);
  const labels = new Map<string, string>();
  const labelOf = new Map<string, string>();
  usable.forEach((c, i) => {
    labels.set(`F${i + 1}`, c.id);
    labelOf.set(c.id, `F${i + 1}`);
  });
  const refs = (ids: string[] | undefined) => {
    const l = (ids ?? []).map((id) => labelOf.get(id)).filter(Boolean);
    return l.length ? ` [${l.join(",")}]` : "";
  };
  const st = (x: SourcedText | undefined | null) => (x?.text ? `${x.text}${refs(x.claim_ids)}` : "");
  const list = (xs: SourcedText[] | undefined, max = 8) => (xs ?? []).slice(0, max).map(st).filter(Boolean);

  const parts: string[] = [];
  parts.push(`DESTINATION: ${report.destination_name} (report version ${loaded.version}, traveller focus: ${report.options?.traveller_type ?? "All"}, period: ${report.options?.travel_period ?? "Any season"})`);
  parts.push(
    "VERIFIED FACT LIBRARY (cite these labels in research_refs; status in brackets):\n" +
      usable.map((c) => `${labelOf.get(c.id)} [${c.status}] (${c.section}) ${c.text}`).join("\n"),
  );
  if (content) {
    const c = content;
    const sec = (title: string, lines: string[]) => lines.length && parts.push(`${title}:\n- ${lines.join("\n- ")}`);
    if (c.executive_summary) parts.push(`EXECUTIVE SUMMARY: ${c.executive_summary}`);
    sec("SNAPSHOT", [st(c.snapshot?.overview), ...list(c.snapshot?.why_visit, 5), ...list(c.snapshot?.seasons, 4), ...list(c.snapshot?.connectivity, 3), ...list(c.snapshot?.entry_requirements, 3)].filter(Boolean));
    sec("WHAT INDIANS ALREADY KNOW (documented India-specific awareness)", list(c.indians_know?.documented));
    sec("GENERALLY POPULAR INTERNATIONALLY (not proven India-specific)", list(c.indians_know?.general_popularity));
    sec("FILM / ENTERTAINMENT LINKS", list(c.indians_know?.entertainment_links, 4));
    sec(
      "UNDER-PROMOTED EXPERIENCES (beyond the usual itinerary)",
      (c.beyond_itinerary ?? []).slice(0, 15).map((p) => `${p.name}, ${p.location}: ${p.description}${p.what_makes_it_different ? ` Different because: ${p.what_makes_it_different}` : ""}${refs(p.claim_ids)}`),
    );
    sec("WELL-KNOWN ATTRACTIONS", (c.top_things ?? []).slice(0, 12).map((p) => `${p.name}, ${p.location}${refs(p.claim_ids)}`));
    sec("CULTURE AND HERITAGE", (c.culture ?? []).flatMap((g) => list(g.items, 3).map((t) => `${g.heading}: ${t}`)).slice(0, 12));
    sec("NATURE AND ADVENTURE", (c.nature ?? []).flatMap((g) => list(g.items, 3).map((t) => `${g.heading}: ${t}`)).slice(0, 10));
    sec("FOOD", [...list(c.food?.dishes, 5), ...list(c.food?.experiences, 4), ...list(c.food?.vegetarian, 3)]);
    sec("SURPRISING FACTS", list(c.surprising_facts, 8));
    sec("INDIA RELEVANCE EVIDENCE", list(c.india_relevance?.evidence));
    sec("BARRIERS AND CONSTRAINTS", list(c.india_relevance?.barriers));
    sec("STRATEGY HYPOTHESES FROM THE REPORT (interpretation, not fact)", (c.india_relevance?.hypotheses ?? []).slice(0, 6));
    sec("TOURISM BOARD INTELLIGENCE", [st(c.board_intel?.organisation), ...list(c.board_intel?.positioning, 4), ...list(c.board_intel?.recent_campaigns, 5), ...list(c.board_intel?.india_activity, 5), ...list(c.board_intel?.priorities, 5), ...list(c.board_intel?.partnerships, 3)].filter(Boolean));
    sec(
      "REPORT'S CAMPAIGN OPPORTUNITY SUMMARY (strategic recommendation, not fact)",
      [...(c.campaign_summary?.opportunities ?? []).map((o) => `${o.title}: ${o.rationale}`), ...(c.campaign_summary?.constraints ?? []).map((x) => `Constraint: ${x}`)],
    );
  }
  return {
    destination: report.destination_name,
    text: parts.join("\n\n"),
    labels,
    hasEvidence: usable.length > 0,
    basis: `${report.destination_name} research report v${loaded.version}`,
  };
}

/** Uploaded or pasted research: untrusted, not verified by plot twist. */
export function buildSuppliedContext(set: CampaignSet): ResearchContext {
  const text = set.supplied_research ?? "";
  return {
    destination: set.destination,
    text:
      `DESTINATION: ${set.destination}\n\nThe following research was ${set.input_mode === "upload" ? `uploaded by a team member (${set.supplied_filename ?? "document"})` : "pasted by a team member"}. ` +
      "It has NOT been verified by plot twist. Use it as background evidence only, do not cite fact labels, and say in research_notes which parts of the supplied research informed the idea.\n\n" +
      asUntrustedBlock("SUPPLIED_RESEARCH", text.slice(0, 24000)),
    labels: new Map(),
    hasEvidence: false,
    basis: set.input_mode === "upload" ? `Uploaded document: ${set.supplied_filename ?? "document"} (not verified)` : "Pasted research (not verified)",
  };
}

export async function contextForSet(set: CampaignSet, version?: number | null): Promise<{ ctx: ResearchContext; loaded: LoadedReport | null }> {
  if (set.report_id) {
    const loaded = await loadReportVersion(set.report_id, version ?? set.report_version);
    if (loaded) return { ctx: buildReportContext(loaded), loaded };
  }
  return { ctx: buildSuppliedContext(set), loaded: null };
}

export function briefText(b: CampaignBrief): string {
  const rows: [string, unknown][] = [
    ["Destination", b.destination],
    ["Tourism board", b.tourism_board],
    ["Campaign objective", b.objective],
    ["Target audience", b.audience],
    ["Travel season", b.season],
    ["Budget tier", b.budget_tier],
    ["Campaign duration", b.duration],
    ["Specific regions or attractions", b.focus_areas],
    ["Preferred channels", b.channels?.join(", ")],
    ["Existing brand positioning", b.positioning],
    ["Creative ambition", b.ambition],
  ];
  const lines = rows.filter(([, v]) => v && String(v).trim()).map(([k, v]) => `${k}: ${String(v).slice(0, 600)}`);
  if (b.inspiration) {
    lines.push(
      `Inspiration (a real reference campaign, "${b.inspiration.name}"). Learn from its mechanism and strategic learning, but create an ORIGINAL, destination-specific execution. ` +
        `Do not reuse its title, characters, executions or line.\nMechanism: ${b.inspiration.mechanism}\nStrategic learning: ${b.inspiration.learning}`,
    );
  }
  return lines.length ? `BRIEF:\n${lines.join("\n")}` : "BRIEF: none supplied beyond the destination.";
}

/** Map model fact labels back to stored claim ids, dropping anything not in the library. */
export function resolveRefs(refs: string[], labels: Map<string, string>): string[] {
  const out = new Set<string>();
  for (const r of refs) {
    for (const m of String(r).match(/F\d+/g) ?? []) {
      const id = labels.get(m);
      if (id) out.add(id);
    }
  }
  return [...out];
}
