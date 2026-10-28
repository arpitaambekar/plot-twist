import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { loadReportVersion } from "@/lib/research/service";
import { ReportView } from "@/components/research/report-view";
import { ReportProgress } from "@/components/research/report-progress";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await db().get("reports", id);
  return { title: r ? `${r.destination_name} report` : "Report" };
}

export default async function ReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ version?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const bundle = await loadReportVersion(id, Number(sp.version) || null);
  if (!bundle) notFound();
  const user = await getCurrentUser();
  const saved = user ? (await db().list("saved_items", { where: { user_id: user.id, item_type: "report", item_id: id } as never, limit: 1 })).length > 0 : false;
  const job = bundle.report.job_id ? await db().get("research_jobs", bundle.report.job_id) : null;

  if (!bundle.content) {
    return <ReportProgress report={bundle.report} job={job} />;
  }
  return <ReportView bundle={bundle} saved={saved} job={bundle.report.status === "generating" ? job : null} />;
}
