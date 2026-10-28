"use client";
import { useEffect, useState } from "react";
import { Star, GitMerge, Scale, AlertCircle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge, Notice, Skeleton } from "@/components/ui/primitives";
import { api } from "@/lib/client";
import type { CampaignIdea, Comparison } from "@/lib/types";
import { cn } from "@/lib/utils";

const CRITERIA = ["Originality", "Destination fit", "Audience relevance", "Strategic strength", "Scapia fit", "Feasibility", "Production complexity", "PR potential", "Conversion opportunity"];

export function CompareDialog({
  open,
  onOpenChange,
  ideas,
  canEdit,
  onShortlist,
  onCombine,
  onOpenIdea,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ideas: CampaignIdea[];
  canEdit: boolean;
  onShortlist: (idea: CampaignIdea) => Promise<void>;
  onCombine: (ids: [string, string]) => void;
  onOpenIdea: (id: string) => void;
}) {
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pick, setPick] = useState<string[]>([]);
  const key = ideas.map((i) => i.id).join(",");

  useEffect(() => {
    if (!open) return;
    setComparison(null);
    setError(null);
    setPick([]);
    setLoading(true);
    api<{ comparison: Comparison }>("/api/ideas/compare", { json: { idea_ids: key.split(",") } })
      .then((r) => setComparison(r.comparison))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key]);

  const scoreOf = (id: string, c: string) => comparison?.scores.find((s) => s.idea_id === id)?.scores[c];
  const pickedShortlisted = pick.length === 2 && pick.every((id) => ["shortlisted", "approved"].includes(ideas.find((i) => i.id === id)?.status ?? ""));

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={`Compare ${ideas.length} concepts`} description="Side by side on the nine studio criteria." wide>
      <Notice tone="peach" title="Subjective AI assessment">
        Scores are an AI reviewer&apos;s opinion (1 weak to 5 strong; for production complexity, 5 means easier to produce). Use them to structure the team&apos;s discussion, not as a verdict.
      </Notice>
      {error && (
        <p className="mt-4 flex items-center gap-2 text-sm text-danger">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-40 border-b border-line pb-3 text-left text-[12px] font-medium text-muted">Criterion</th>
              {ideas.map((i) => (
                <th key={i.id} className="border-b border-line px-3 pb-3 text-left align-bottom">
                  <label className="flex items-start gap-2">
                    {canEdit && (
                      <input
                        type="checkbox"
                        className="mt-1 accent-[#4169D7]"
                        checked={pick.includes(i.id)}
                        onChange={(e) => setPick((p) => (e.target.checked ? [...p, i.id].slice(-2) : p.filter((x) => x !== i.id)))}
                        aria-label={`Pick ${i.content.name} to combine`}
                      />
                    )}
                    <span>
                      <button onClick={() => onOpenIdea(i.id)} className="text-left text-[14px] font-semibold text-ink hover:text-accent">
                        {i.content.name}
                      </button>
                      <span className="mt-0.5 block text-[12px] font-normal text-muted">{i.content.campaign_type}</span>
                    </span>
                  </label>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CRITERIA.map((c) => (
              <tr key={c} className="align-top">
                <td className="border-b border-line py-3 pr-3 text-[13px] font-medium text-ink">{c}</td>
                {ideas.map((i) => {
                  const s = scoreOf(i.id, c);
                  return (
                    <td key={i.id} className="border-b border-line px-3 py-3">
                      {loading ? (
                        <Skeleton className="h-4 w-24" />
                      ) : s ? (
                        <>
                          <div className="flex items-center gap-1" aria-label={`${s.score} out of 5`}>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <span key={n} className={cn("h-1.5 w-5 rounded-full", n <= s.score ? "bg-accent" : "bg-ink/10")} />
                            ))}
                            <span className="ml-1.5 text-[12px] font-medium tabular-nums text-ink">{s.score}/5</span>
                          </div>
                          <p className="mt-1.5 text-[12px] leading-snug text-muted">{s.rationale}</p>
                        </>
                      ) : (
                        <span className="text-[12px] text-muted">Not scored</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="align-top">
              <td className="py-3 pr-3 text-[13px] font-medium text-ink">Reviewer summary</td>
              {ideas.map((i) => (
                <td key={i.id} className="px-3 py-3 text-[12.5px] text-ink/80">
                  {loading ? <Skeleton className="h-10 w-full" /> : comparison?.scores.find((s) => s.idea_id === i.id)?.summary}
                  {canEdit && (
                    <div className="mt-3">
                      <Button size="sm" variant={["shortlisted", "approved"].includes(i.status) ? "outline" : "secondary"} onClick={() => onShortlist(i)}>
                        <Star className={cn("h-3.5 w-3.5", ["shortlisted", "approved"].includes(i.status) && "fill-current text-accent")} />
                        {["shortlisted", "approved"].includes(i.status) ? "Shortlisted" : "Shortlist"}
                      </Button>
                    </div>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {comparison?.verdict && (
        <div className="mt-5 rounded-xl bg-soft-blue/60 p-4 text-sm text-ink">
          <p className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-accent">
            <Scale className="h-3.5 w-3.5" /> Overall view (subjective)
          </p>
          {comparison.verdict}
        </div>
      )}
      {canEdit && (
        <div className="mt-5 flex flex-col items-start justify-between gap-3 border-t border-line pt-4 sm:flex-row sm:items-center">
          <p className="text-[13px] text-muted">{pick.length === 2 ? (pickedShortlisted ? "Ready to combine." : "Shortlist both picked concepts to combine them.") : "Tick two concepts to combine them into a new idea. The originals stay as they are."}</p>
          <Button disabled={!pickedShortlisted} onClick={() => onCombine([pick[0], pick[1]])}>
            <GitMerge className="h-4 w-4" /> Combine picked two
          </Button>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {ideas.map((i) => (
          <Badge key={i.id} tone="neutral">
            v{i.version} · {i.content.name}
          </Badge>
        ))}
      </div>
    </Dialog>
  );
}
