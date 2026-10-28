import "server-only";
import type { ResearchJob } from "@/lib/types";

// Placeholder: implemented in the feature build.
export async function runContactJob(job: ResearchJob): Promise<void> {
  throw new Error(`${job.kind} is not implemented yet`);
}
