import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/primitives";
import { StudioLanding, type ReportOption, type SetSummary } from "@/components/studio/studio-landing";

export const metadata = { title: "Campaign Studio" };

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ report?: string; reference?: string; destination?: string }> }) {
  const sp = await searchParams;
  const store = db();
  const [reports, sets, ideas] = await Promise.all([
    store.list("reports", { orderBy: { column: "updated_at" }, limit: 200 }),
    store.list("campaign_sets", { orderBy: { column: "created_at" }, limit: 60 }),
    store.list("campaign_ideas", { orderBy: { column: "updated_at" }, limit: 2000 }),
  ]);
  const reference = sp.reference ? await store.get("reference_campaigns", sp.reference) : null;

  const reportOptions: ReportOption[] = reports
    .filter((r) => r.content && (r.status === "completed" || r.status === "partial"))
    .map((r) => ({
      id: r.id,
      destination: r.destination_name,
      version: r.version,
      status: r.status,
      updated_at: r.updated_at,
      evidence_pct: r.health?.evidence_pct ?? null,
      claims: r.health?.total_claims ?? 0,
      traveller: r.options?.traveller_type ?? "All",
      board: (() => {
        const t = r.content?.board_intel?.organisation?.text ?? "";
        return t && t.length <= 80 ? t : null;
      })(),
      is_demo: r.is_demo,
    }));

  const setSummaries: SetSummary[] = sets.map((s) => {
    const mine = ideas.filter((i) => i.set_id === s.id);
    return {
      id: s.id,
      title: s.title,
      destination: s.destination,
      status: s.status,
      created_at: s.created_at,
      idea_count: mine.length,
      shortlisted: mine.filter((i) => i.status === "shortlisted" || i.status === "approved").length,
      cover: mine.find((i) => i.image)?.image ?? null,
      basis: s.report_id ? `Research report v${s.report_version}` : s.input_mode === "upload" ? `Upload: ${s.supplied_filename ?? "document"}` : "Pasted research",
      is_demo: s.is_demo,
    };
  });

  return (
    <div>
      <PageHeader eyebrow="Plot Something Big" title="Let's plot something big." subtitle="Turn destination insights into ideas worth talking about." />
      <StudioLanding
        reports={reportOptions}
        sets={setSummaries}
        initialReportId={sp.report && reportOptions.some((r) => r.id === sp.report) ? sp.report : null}
        initialDestination={sp.destination ?? ""}
        reference={
          reference
            ? { id: reference.id, name: reference.name, board: reference.tourism_board, destination: reference.destination, mechanism: reference.participation_mechanism, idea: reference.creative_idea, learning: reference.strategic_learning, verification: reference.verification }
            : null
        }
      />
    </div>
  );
}
