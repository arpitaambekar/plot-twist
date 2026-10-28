import { route, notFound } from "@/lib/api";
import { db } from "@/lib/db";
import { JOB_LABEL } from "@/lib/jobs";

export const GET = route<{ id: string }>("viewer", async ({ params }) => {
  const job = await db().get("research_jobs", params.id);
  if (!job) throw notFound("Job");
  return { job: { ...job, label: JOB_LABEL[job.status] } };
});
