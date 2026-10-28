"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Loader2, AlertCircle, RotateCcw } from "lucide-react";
import type { JobStatus, Report, ResearchJob } from "@/lib/types";
import { Card, Notice } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";
import { useSession } from "@/components/shell/user-context";
import { cn, fmtDateTime } from "@/lib/utils";

const STEPS: { key: JobStatus; label: string }[] = [
  { key: "queued", label: "Job created" },
  { key: "finding_sources", label: "Finding sources" },
  { key: "extracting_facts", label: "Extracting facts" },
  { key: "verifying", label: "Verifying every quote" },
  { key: "generating_report", label: "Generating report" },
];
const ORDER: JobStatus[] = ["queued", "finding_sources", "extracting_facts", "verifying", "generating_report", "completed"];

/** Polls the durable job and shows its real stage. No invented percentages. */
export function useJob(jobId: string | null, initial: ResearchJob | null) {
  const [job, setJob] = useState<ResearchJob | null>(initial);
  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await api<{ job: ResearchJob }>(`/api/jobs/${jobId}`);
        if (stop) return;
        setJob(r.job);
        if (r.job.status === "completed" || r.job.status === "failed") return;
      } catch {
        /* transient: keep polling */
      }
      if (!stop) setTimeout(tick, 2500);
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [jobId]);
  return job;
}

export function JobStages({ job }: { job: ResearchJob | null }) {
  const idx = job ? ORDER.indexOf(job.status) : 0;
  return (
    <ol className="space-y-2.5">
      {STEPS.map((s, i) => {
        const done = job?.status === "completed" || (idx > i && job?.status !== "failed") || (job?.status === "failed" && i < lastReached(job));
        const current = job?.status !== "failed" && idx === i;
        const failed = job?.status === "failed" && i === lastReached(job);
        return (
          <li key={s.key} className="flex items-center gap-3 text-[14px]">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border",
                done && "border-mint-ink/30 bg-soft-mint text-mint-ink",
                current && "border-accent/40 bg-soft-blue text-accent",
                failed && "border-danger/30 bg-soft-danger text-danger",
                !done && !current && !failed && "border-line text-muted",
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : current ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : failed ? <AlertCircle className="h-3.5 w-3.5" /> : <span className="text-[11px]">{i + 1}</span>}
            </span>
            <span className={cn(done || current ? "text-ink" : "text-muted", current && "font-medium")}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function lastReached(job: ResearchJob) {
  // Find the furthest stage mentioned in the job log before failure.
  let max = 0;
  for (const l of job.log) {
    STEPS.forEach((s, i) => {
      if (l.message.toLowerCase().startsWith(s.label.toLowerCase().split(" ")[0])) max = Math.max(max, i);
    });
  }
  return max;
}

export function ReportProgress({ report, job: initialJob }: { report: Report; job: ResearchJob | null }) {
  const router = useRouter();
  const { can } = useSession();
  const job = useJob(report.job_id, initialJob);
  const [retrying, setRetrying] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (job?.status === "completed") {
      const t = setTimeout(() => router.refresh(), 1200);
      return () => clearTimeout(t);
    }
  }, [job?.status, router]);

  async function retry() {
    setRetrying(true);
    setErr(null);
    try {
      await api(`/api/research/${report.id}/refresh`, { method: "POST" });
      router.refresh();
      window.location.reload();
    } catch (e) {
      setErr((e as Error).message);
      setRetrying(false);
    }
  }

  const failed = job?.status === "failed" || report.status === "failed";
  return (
    <div className="mx-auto max-w-2xl py-10">
      <p className="eyebrow mb-3">Destination report</p>
      <h1 className="text-[44px] font-semibold leading-none tracking-[-0.04em] text-ink md:text-[56px]">
        {report.query}
        <span className="text-accent">.</span>
      </h1>
      <p className="mt-3 text-muted">
        {report.options.traveller_type} · {report.options.travel_period} · {report.options.depth === "quick" ? "Quick overview" : "Comprehensive research"}
      </p>
      <Card className="mt-8 p-6">
        {failed ? (
          <div className="space-y-4">
            <Notice tone="danger" title="Research failed">
              {job?.error ?? "The research job stopped before finishing."} Nothing was made up to fill the gap.
            </Notice>
            <JobStages job={job} />
            {can("editor") && (
              <Button onClick={retry} loading={retrying}>
                <RotateCcw className="h-4 w-4" /> Retry research
              </Button>
            )}
            {err && <p className="text-sm text-danger">{err}</p>}
          </div>
        ) : job?.status === "completed" ? (
          <p className="text-[17px] font-medium text-ink">Turns out, there&apos;s more to the story.</p>
        ) : (
          <div className="space-y-5">
            <p className="animate-soft-pulse text-[17px] font-medium text-ink">Looking beyond the obvious…</p>
            <JobStages job={job} />
            <p className="text-[12px] text-muted">Comprehensive research usually takes a few minutes. You can leave this page; the job keeps running and the report appears here when it is ready.</p>
          </div>
        )}
        {job && job.log.length > 0 && (
          <details className="mt-5 text-[12px] text-muted">
            <summary className="cursor-pointer">Activity log</summary>
            <ul className="mt-2 space-y-1">
              {job.log.slice(-12).map((l, i) => (
                <li key={i}>
                  <span className="tabular-nums">{fmtDateTime(l.at)}</span> · {l.message}
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>
      <p className="mt-6 text-sm">
        <Link href="/research" className="text-accent hover:underline">
          Back to Destination Research
        </Link>
      </p>
    </div>
  );
}
