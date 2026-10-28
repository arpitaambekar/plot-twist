import "server-only";
import { Paragraph, TextRun, type Table } from "docx";
import type { PlaceItem, SourcedText } from "@/lib/types";
import type { ReportBundle } from "@/lib/research/service";
import { bullet, buildDocx, coverPage, h1, h2, h3, imageParagraph, label, link, note, para, pageBreak, table } from "./docx-common";
import { fmtDate } from "@/lib/utils";
import { isStale } from "@/lib/freshness";

/** Editable Word version of a destination report, with numbered citations and a source library. */
export async function buildReportDocx(bundle: ReportBundle): Promise<Buffer> {
  const { report, content, claims, sources } = bundle;
  if (!content) throw new Error("Report has no content");
  const claimMap = new Map(claims.map((c) => [c.id, c]));
  const srcNum = new Map(bundle.source_ids.map((id, i) => [id, i + 1]));
  const cites = (ids: string[]) => [...new Set(ids.flatMap((id) => claimMap.get(id)?.evidence.filter((e) => e.quote_found).map((e) => srcNum.get(e.source_id) ?? 0) ?? []))].filter(Boolean).sort((a, b) => a - b);
  const out: (Paragraph | Table)[] = [];
  const bullets = (items: SourcedText[]) => items.forEach((i) => out.push(bullet(i.text, cites(i.claim_ids))));
  const sub = (title: string, items: SourcedText[]) => {
    if (!items.length) return;
    out.push(h3(title));
    bullets(items);
  };
  const health = bundle.health;
  const opts = report.options;

  out.push(
    ...coverPage({
      kicker: "Destination report",
      title: report.destination_name,
      subtitle: `For Indian outbound travellers · ${opts.traveller_type} · ${opts.travel_period || "Any season"}`,
      meta: [
        `Version ${bundle.version} · Research generated ${fmtDate(report.created_at)} · Last updated ${fmtDate(report.updated_at)}`,
        `Depth: ${opts.depth === "quick" ? "Quick overview" : "Comprehensive research"}`,
        health ? `Evidence coverage: ${health.evidence_pct}% of ${health.total_claims} claims · ${health.source_count} cited sources (${health.official_source_count} official)` : "",
        report.is_demo ? "DEMO DATA: generated from offline fixtures, not real research." : "",
      ].filter(Boolean),
    }),
  );
  out.push(...(await imageParagraph(content.snapshot.hero_image, 600)));

  out.push(h1("Executive summary"));
  out.push(para(content.executive_summary));
  out.push(
    note(
      "How to read this report: statements with [n] are verified facts linked to the numbered source library. Sections marked Strategic interpretation or Creative hypothesis are analysis, not facts. Unsupported statements were held back and are listed in the verification notes.",
    ),
  );
  if (report.partial_notes.length) {
    out.push(label("Research gaps"));
    report.partial_notes.forEach((n) => out.push(bullet(n)));
  }

  // 1 Snapshot
  out.push(h1("1. Destination snapshot"));
  const s = content.snapshot;
  if (s.location.text) out.push(para(s.location.text, { cites: cites(s.location.claim_ids), label: "LOCATION" }));
  if (s.overview.text) out.push(para(s.overview.text, { cites: cites(s.overview.claim_ids) }));
  if (s.trip_duration.text) out.push(para(s.trip_duration.text, { cites: cites(s.trip_duration.claim_ids), label: "TYPICAL TRIP" }));
  sub("Why travellers visit", s.why_visit);
  sub("Main travel experiences", s.experiences);
  sub("Seasons", s.seasons);
  sub("Travel considerations", s.considerations);
  out.push(h3("Entry requirements for Indian passport holders"));
  if (s.entry_requirements.length) bullets(s.entry_requirements);
  else out.push(para("Not supported by an official source in this research run. Check the destination's official immigration website before travel.", { italic: true }));
  out.push(note("Visa and entry rules change frequently. Re-verify with the official source before any external use."));
  sub("Connectivity from India", s.connectivity);

  // 2 What Indians already know
  out.push(h1("2. What Indians already know"));
  out.push(note(content.indians_know.awareness_note));
  sub("Documented India-specific awareness", content.indians_know.documented);
  sub("Internationally famous (not evidence of Indian awareness)", content.indians_know.general_popularity);
  sub("Film and entertainment connections", content.indians_know.entertainment_links);

  // 3 Beyond the usual itinerary
  out.push(pageBreak(), h1("3. Beyond the usual itinerary"));
  out.push(para("Places and experiences that are under-promoted or less common in mainstream itineraries, based on the sources retrieved.", { italic: true, color: "747D86" }));
  for (const p of content.beyond_itinerary) await placeBlock(out, p, cites, true);

  // 4 Culture & heritage
  out.push(h1("4. Culture and heritage"));
  content.culture.forEach((g) => sub(g.heading, g.items));
  if (!content.culture.length) out.push(para("No verified cultural findings in this run.", { italic: true }));

  // 5 Adventure & nature
  out.push(h1("5. Adventure and nature"));
  content.nature.forEach((g) => sub(g.heading, g.items));
  if (!content.nature.length) out.push(para("No verified nature findings in this run.", { italic: true }));
  out.push(note("Check permits, seasonal closures and safety advisories with official park or tourism authorities before recommending any activity."));

  // 6 Food
  out.push(h1("6. Food and culinary experiences"));
  sub("Dishes and specialities", content.food.dishes);
  sub("Culinary experiences", content.food.experiences);
  out.push(h3("Vegetarian availability"));
  if (content.food.vegetarian.length) bullets(content.food.vegetarian);
  else out.push(para("Vegetarian availability was not established by the sources retrieved.", { italic: true }));
  sub("Notes", content.food.notes);

  // 7 Top things to do
  out.push(pageBreak(), h1("7. Top destinations and things to do"));
  if (content.top_things.length)
    out.push(
      table(
        ["Name", "Location", "Why it is famous", "Best for", "Sources"],
        content.top_things.map((p) => [p.name, p.location, p.why_famous || p.description, p.traveller_segment ?? "", cites(p.claim_ids).map((n) => `[${n}]`).join("")]),
        [20, 18, 40, 12, 10],
      ),
    );
  for (const p of content.top_things) await placeBlock(out, p, cites, false);

  // 8 Facts
  out.push(h1("8. Eight surprising facts"));
  content.surprising_facts.forEach((f, i) => out.push(para(`${i + 1}. ${f.text}`, { cites: cites(f.claim_ids) })));
  if (content.facts_gap_note) out.push(note(content.facts_gap_note));

  // 9 India relevance
  out.push(h1("9. Why it matters to Indian travellers"));
  sub("Research evidence", content.india_relevance.evidence);
  sub("Potential barriers", content.india_relevance.barriers);
  if (content.india_relevance.segments.length) {
    out.push(h3("Relevant audience segments (strategic interpretation)"));
    content.india_relevance.segments.forEach((x) => out.push(bullet(x)));
  }
  if (content.india_relevance.hypotheses.length) {
    out.push(h3("Strategy hypotheses (not facts)"));
    content.india_relevance.hypotheses.forEach((x) => out.push(bullet(x)));
  }

  // 10 Board intelligence
  out.push(h1("10. Tourism board marketing intelligence"));
  const b = content.board_intel;
  out.push(para(b.organisation.text, { cites: cites(b.organisation.claim_ids), label: "ORGANISATION" }));
  if (b.website) out.push(new Paragraph({ children: [new TextRun({ text: "Website: ", size: 19 }), link(b.website, b.website)] }));
  sub("Current positioning", b.positioning);
  sub("Recent campaigns", b.recent_campaigns);
  sub("India-market activity", b.india_activity);
  sub("Published priorities", b.priorities);
  sub("Partnerships", b.partnerships);
  out.push(note(b.note));

  // 11 Campaign summary
  out.push(pageBreak(), h1("11. Campaign opportunity summary"));
  out.push(note("Strategic recommendations from plot twist. analysis. These are not tourism-board statements or confirmed opportunities."));
  const cs = content.campaign_summary;
  if (cs.opportunities.length) {
    out.push(h3("Three strongest opportunities"));
    cs.opportunities.forEach((o) => out.push(para(`${o.title}. ${o.rationale}`)));
  }
  if (cs.territories.length) {
    out.push(h3("Creative territories (creative hypotheses)"));
    cs.territories.forEach((t) => out.push(para(`${t.name}. ${t.description}`)));
  }
  if (cs.segments.length) {
    out.push(h3("Target traveller segments"));
    cs.segments.forEach((x) => out.push(bullet(x)));
  }
  if (cs.scapia_touchpoints.length) {
    out.push(h3("Potential Scapia marketing touchpoints"));
    cs.scapia_touchpoints.forEach((x) => out.push(bullet(x)));
  }
  if (cs.constraints.length) {
    out.push(h3("Practical constraints"));
    cs.constraints.forEach((x) => out.push(bullet(x)));
  }
  if (cs.next_step) out.push(para(cs.next_step, { label: "RECOMMENDED NEXT STEP" }));

  // Verification notes
  out.push(pageBreak(), h1("Verification notes"));
  if (health) {
    out.push(
      table(
        ["Measure", "Value"],
        [
          ["Claims extracted", String(health.total_claims)],
          ["Claims with evidence found in source text", `${health.evidenced_claims} (${health.evidence_pct}%)`],
          ["Verified (primary source)", String(health.by_status.Verified)],
          ["Corroborated (2+ independent sources)", String(health.by_status.Corroborated)],
          ["Needs verification (single non-official source)", String(health.by_status["Needs Verification"])],
          ["Unverified (held back from the report)", String(health.by_status.Unverified)],
          ["Potentially stale facts", String(claims.filter((c) => isStale(c)).length)],
          ["Cited sources (official)", `${health.source_count} (${health.official_source_count})`],
        ],
        [70, 30],
      ),
    );
  }
  const unresolved = claims.filter((c) => c.status === "Needs Verification" || c.status === "Unverified");
  if (unresolved.length) {
    out.push(h3("Statements needing verification"));
    unresolved.slice(0, 60).forEach((c) => out.push(bullet(`${c.status}: ${c.text} (${c.status_reason})`)));
  }

  // Source library
  out.push(h1("Source library"));
  sources.forEach((src) => {
    const n = srcNum.get(src.id) ?? 0;
    out.push(
      new Paragraph({
        spacing: { after: 100 },
        children: [
          new TextRun({ text: `[${n}] `, bold: true, size: 18, color: "4169D7" }),
          new TextRun({ text: `${src.title}. ${src.publisher} (${src.source_type.replace("_", " ")}). Published ${fmtDate(src.published_at)}; retrieved ${fmtDate(src.retrieved_at)}. `, size: 18 }),
          link(src.url, src.url),
        ],
      }),
    );
  });

  return buildDocx(`${report.destination_name} destination report`, out);
}

async function placeBlock(out: (Paragraph | Table)[], p: PlaceItem, cites: (ids: string[]) => number[], detailed: boolean) {
  out.push(h2(p.name));
  if (p.location) out.push(para(p.location, { color: "747D86", size: 19 }));
  out.push(...(await imageParagraph(p.image, 420)));
  out.push(para(p.description, { cites: cites(p.claim_ids) }));
  const rows: [string, string | undefined][] = detailed
    ? [
        ["Why it is special", p.why_special],
        ["What makes it different", p.what_makes_it_different],
        ["Activities", p.activities?.join(", ")],
        ["Suitable for", p.traveller_segment],
        ["Seasonality", p.seasonality],
        ["Access", p.accessibility],
        ["Relevance to Indian travellers", p.india_relevance],
      ]
    : [["Why it is famous", p.why_famous]];
  rows.filter(([, v]) => v).forEach(([k, v]) => out.push(para(v!, { label: k.toUpperCase() })));
}
