import { route, notFound, HttpError } from "@/lib/api";
import { loadReportVersion } from "@/lib/research/service";
import { buildReportDocx } from "@/lib/export/report-docx";
import { docxResponse } from "@/lib/export/docx-common";
import { recordUsage } from "@/lib/security/rate-limit";
import { audit } from "@/lib/audit";
import { slugify } from "@/lib/seed";

export const maxDuration = 60;

export const GET = route<{ id: string }>("viewer", async ({ user, params, req }) => {
  const v = Number(new URL(req.url).searchParams.get("version") ?? "") || null;
  const bundle = await loadReportVersion(params.id, v);
  if (!bundle) throw notFound("Report");
  if (!bundle.content) throw new HttpError(409, "This report has no completed content to export yet.");
  const buf = await buildReportDocx(bundle);
  await recordUsage(user.id, "export", 1, { report: params.id, version: bundle.version });
  await audit(user.email, "research.export", params.id, { version: bundle.version });
  const date = new Date().toISOString().slice(0, 10);
  return docxResponse(buf, `plot-twist-${slugify(bundle.report.destination_name)}-report-v${bundle.version}-${date}.docx`);
});
