import { db } from "@/lib/db";
import { findPhoto } from "@/lib/images";
import { ResearchHome, type DirectoryCard, type ReportSummary } from "@/components/research/research-home";
import type { ImageRef } from "@/lib/types";

export const metadata = { title: "Destination Research" };

export default async function ResearchPage({ searchParams }: { searchParams: Promise<{ destination?: string }> }) {
  const sp = await searchParams;
  const store = db();
  const [destinations, reports] = await Promise.all([store.list("destinations", { orderBy: { column: "name", ascending: true } }), store.list("reports", { orderBy: { column: "updated_at" }, limit: 60 })]);

  const photos = await Promise.all(
    destinations.map((d) =>
      Promise.race([findPhoto(d.photo_query, { file: d.photo_file, alt: d.name }), new Promise<null>((r) => setTimeout(() => r(null), 6000))]).catch(() => null),
    ),
  );
  const directory: DirectoryCard[] = destinations.map((d, i) => ({
    id: d.id,
    name: d.name,
    continent: d.continent,
    tourism_board: d.tourism_board,
    tagline: d.tagline,
    image: (photos[i] as ImageRef | null) ?? null,
    report_id: reports.find((r) => r.destination_name.toLowerCase() === d.name.toLowerCase() && r.content)?.id ?? null,
  }));
  const summaries: ReportSummary[] = reports.map((r) => ({
    id: r.id,
    destination_name: r.destination_name,
    query: r.query,
    version: r.version,
    status: r.status,
    options: r.options,
    evidence_pct: r.health?.evidence_pct ?? null,
    claims: r.health?.total_claims ?? null,
    unresolved: r.health?.unresolved_claims ?? null,
    updated_at: r.updated_at,
    image: r.content?.snapshot.hero_image ?? null,
    is_demo: r.is_demo,
  }));
  return <ResearchHome directory={directory} reports={summaries} prefill={sp.destination ?? ""} />;
}
