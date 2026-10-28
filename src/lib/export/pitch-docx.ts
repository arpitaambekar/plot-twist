import "server-only";
import { Paragraph, TextRun, type Table } from "docx";
import type { CampaignIdea, Pitch, SourceRecord } from "@/lib/types";
import { PITCH_SECTIONS } from "@/lib/types";
import { buildDocx, bullet, coverPage, h1, h2, imageParagraph, link, note, para, table } from "./docx-common";
import { fmtDate } from "@/lib/utils";

function body(text: string): Paragraph[] {
  return String(text ?? "")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (/^[•\-*]\s+/.test(l) ? bullet(l.replace(/^[•\-*]\s+/, "")) : /^\d+[.)]\s+/.test(l) ? bullet(l) : para(l)));
}

/** Editable Word pitch: cover, summary table, the 20 pitch sections and clickable sources. */
export async function buildPitchDocx(pitch: Pitch, idea: CampaignIdea, sources: SourceRecord[]): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    ...coverPage({
      kicker: "Partnership pitch",
      title: pitch.title,
      subtitle: `${pitch.destination} · ${idea.content.line}`,
      meta: [`Prepared ${fmtDate(new Date().toISOString())}`, `Pitch version ${pitch.version} · Concept version ${idea.version}`, ...(pitch.is_demo ? ["DEMO FIXTURE CONTENT: not for external use"] : [])],
    }),
    ...(await imageParagraph(idea.image)),
    h1("At a glance"),
    table(
      ["", ""],
      [
        ["Campaign", idea.content.name],
        ["Line", idea.content.line],
        ["Type", idea.content.campaign_type],
        ["Audience", idea.content.target_audience],
        ["Budget tier (relative complexity)", idea.content.budget_tier],
        ["Feasibility", idea.content.feasibility],
        ["Dependencies", idea.content.dependency_flags.join(", ") || "None flagged"],
      ],
      [30, 70],
    ),
    note("Facts in this pitch come from linked research. Strategic interpretation and creative hypotheses are proposals for discussion, not tourism-board statements or commitments."),
  ];
  PITCH_SECTIONS.forEach(([key, label], i) => {
    if (key === "supporting_research") return;
    children.push(h2(`${i + 1}. ${label}`), ...body(pitch.sections[key]));
  });
  children.push(h1("20. Supporting research and sources"));
  const research = pitch.sections.supporting_research ?? "";
  const [main] = research.split(/\n\s*Sources:\n/);
  children.push(...body(main));
  if (sources.length) {
    children.push(h2("Sources"));
    sources.forEach((s, i) =>
      children.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [link(`[${i + 1}] ${s.title}`, s.url), new TextRun({ text: `  ${s.publisher}. Retrieved ${fmtDate(s.retrieved_at)}. ${s.url}`, size: 18, color: "747D86", font: "Calibri" })],
        }),
      ),
    );
  }
  return buildDocx(pitch.title, children);
}
