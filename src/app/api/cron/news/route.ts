import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createJob, executeJob } from "@/lib/jobs";
import { activeNewsJob, newsIsStale } from "@/lib/news/refresh";

export const maxDuration = 300;

/** Scheduled news ingestion (see vercel.json). Honours the admin refresh interval. */
export async function GET(req: Request) {
  if (!env.cronSecret || req.headers.get("authorization") !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const force = new URL(req.url).searchParams.get("force") === "1";
  if (!force && !(await newsIsStale())) return NextResponse.json({ ok: true, skipped: "News is fresh" });
  if (await activeNewsJob()) return NextResponse.json({ ok: true, skipped: "A refresh is already running" });
  const job = await createJob("news_refresh", { trigger: "cron" }, "system:cron");
  await executeJob(job.id);
  return NextResponse.json({ ok: true, job: job.id });
}
