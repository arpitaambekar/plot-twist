"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/components/shell/user-context";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import { fmtDateTime, timeAgo } from "@/lib/utils";
import type { ResearchJob } from "@/lib/types";

type JobView = ResearchJob & { label: string };

export function RefreshBar({
  lastRefreshAt,
  runningJobId,
  lastJob,
  feeds,
  searchReady,
}: {
  lastRefreshAt: string | null;
  runningJobId: string | null;
  lastJob: { status: string; error: string | null; message: string } | null;
  feeds: { name: string; status: string; error: string | null }[];
  searchReady: boolean;
}) {
  const { can } = useSession();
  const toast = useToast();
  const router = useRouter();
  const [jobId, setJobId] = useState<string | null>(runningJobId);
  const [job, setJob] = useState<JobView | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setJobId(runningJobId), [runningJobId]);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await api<{ job: JobView }>(`/api/jobs/${jobId}`);
        if (cancelled) return;
        setJob(r.job);
        if (r.job.status === "completed" || r.job.status === "failed") {
          setJobId(null);
          if (r.job.status === "completed") toast(r.job.log[r.job.log.length - 1]?.message ?? "News refreshed.");
          else toast(r.job.error ?? "Refresh failed. Showing cached stories.", "error");
          router.refresh();
          return;
        }
      } catch {
        /* keep polling */
      }
      timer.current = setTimeout(poll, 2500);
    };
    poll();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [jobId, router, toast]);

  async function refresh() {
    try {
      const r = await api<{ job: ResearchJob }>("/api/news/refresh", { method: "POST" });
      setJobId(r.job.id);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  const failedFeeds = feeds.filter((f) => f.status === "failed");
  const running = Boolean(jobId);
  const lastFailed = !running && lastJob?.status === "failed";

  return (
    <div className="flex flex-col items-start gap-2 md:items-end">
      <div className="flex items-center gap-3">
        <span className="text-[12px] text-muted" title={lastRefreshAt ? fmtDateTime(lastRefreshAt) : undefined}>
          {running ? (
            <span className="inline-flex items-center gap-1.5 text-accent">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {job ? `${job.label}: ${job.log[job.log.length - 1]?.message ?? ""}` : "Refreshing…"}
            </span>
          ) : (
            <>Last updated {lastRefreshAt ? `${timeAgo(lastRefreshAt)} · ${fmtDateTime(lastRefreshAt)}` : "never"}</>
          )}
        </span>
        {can("editor") && (
          <Button variant="secondary" size="sm" onClick={refresh} disabled={running}>
            <RefreshCw className={running ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Refresh
          </Button>
        )}
      </div>
      {lastFailed && (
        <p className="inline-flex max-w-md items-start gap-1.5 text-[12px] text-peach-ink">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Live retrieval failed on the last run, so you&apos;re seeing cached stories. {lastJob?.error ?? ""}
        </p>
      )}
      {!running && !lastFailed && (failedFeeds.length > 0 || !searchReady) && (
        <p className="max-w-md text-[12px] text-muted md:text-right">
          {failedFeeds.length > 0 && <>{failedFeeds.length} of {feeds.length} feed(s) unreachable on the last run ({failedFeeds.map((f) => f.name).join(", ")}). </>}
          {!searchReady && <>Live news search is not configured, so only RSS feeds are read.</>}
        </p>
      )}
    </div>
  );
}
