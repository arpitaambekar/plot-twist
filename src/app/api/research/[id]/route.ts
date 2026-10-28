import { route, notFound } from "@/lib/api";
import { loadReportVersion } from "@/lib/research/service";

/**
 * A report at an exact version with its claims and sources. Campaign Studio uses this to
 * stay linked to the version it was generated from.
 */
export const GET = route<{ id: string }>("viewer", async ({ params, req }) => {
  const v = Number(new URL(req.url).searchParams.get("version") ?? "") || null;
  const bundle = await loadReportVersion(params.id, v);
  if (!bundle) throw notFound("Report");
  return bundle;
});
