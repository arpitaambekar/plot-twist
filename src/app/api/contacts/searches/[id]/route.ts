import { route, notFound } from "@/lib/api";
import { db } from "@/lib/db";
import { JOB_LABEL } from "@/lib/jobs";

export const GET = route<{ id: string }>("viewer", async ({ params }) => {
  const search = await db().get("contact_searches", params.id);
  if (!search) throw notFound("Search");
  const jobs = await db().list("research_jobs", { where: { kind: "contact_search" } as never, orderBy: { column: "created_at" }, limit: 50 });
  const job = jobs.find((j) => (j.input as { search_id?: string }).search_id === search.id) ?? null;
  const contacts = search.contact_ids.length ? await db().list("contacts", { in: { column: "id", values: search.contact_ids } }) : [];
  return { search, contacts, job: job ? { status: job.status, label: JOB_LABEL[job.status], log: job.log.slice(-6), error: job.error } : null };
});
