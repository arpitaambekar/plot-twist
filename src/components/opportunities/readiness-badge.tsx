import type { ReadinessStatus } from "@/lib/opportunities/readiness";
import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export const READINESS_ORDER: ReadinessStatus[] = ["Research Needed", "Research Ready", "Outreach Ready", "Pitch in Development", "Pitch Ready"];

export function ReadinessBadge({ status }: { status: ReadinessStatus }) {
  const tone = status === "Pitch Ready" ? "mint" : status === "Research Needed" ? "peach" : "blue";
  return <Badge tone={tone}>{status}</Badge>;
}

export function ReadinessBar({ pct, className }: { pct: number; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.07]", className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Checklist completion">
      <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function PriorityDot({ priority }: { priority: string }) {
  const c = priority === "High" ? "bg-danger" : priority === "Medium" ? "bg-accent" : "bg-muted/50";
  return <span className={cn("inline-block h-2 w-2 rounded-full", c)} aria-hidden />;
}
