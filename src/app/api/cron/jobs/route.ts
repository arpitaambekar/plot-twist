import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { resumeStaleJobs } from "@/lib/jobs";

export const maxDuration = 300;

/** Scheduled worker (see vercel.json): resumes queued or stalled research jobs. */
export async function GET(req: Request) {
  if (!env.cronSecret || req.headers.get("authorization") !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const resumed = await resumeStaleJobs();
  return NextResponse.json({ ok: true, resumed });
}
