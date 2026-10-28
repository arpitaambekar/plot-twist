"use client";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { ExternalLink, AlertTriangle } from "lucide-react";
import type { Claim, SourceRecord } from "@/lib/types";
import { Sheet } from "@/components/ui/dialog";
import { ClaimStatusBadge } from "./status-badge";
import { fmtDate, cn } from "@/lib/utils";
import { isStale } from "@/lib/freshness";

interface CiteCtx {
  claims: Record<string, Claim>;
  sources: Record<string, SourceRecord>;
  sourceNumber: (sourceId: string) => number;
  open: (claimIds: string[]) => void;
}

const Ctx = createContext<CiteCtx | null>(null);

/**
 * Provides claim/source lookups and the source drawer for any surface that shows sourced facts.
 * Source numbers follow the order of `sourceOrder` (the report's source library).
 */
export function CitationProvider({ claims, sources, sourceOrder, children }: { claims: Claim[]; sources: SourceRecord[]; sourceOrder?: string[]; children: ReactNode }) {
  const [openIds, setOpenIds] = useState<string[] | null>(null);
  const value = useMemo<CiteCtx>(() => {
    const cm = Object.fromEntries(claims.map((c) => [c.id, c]));
    const sm = Object.fromEntries(sources.map((s) => [s.id, s]));
    const order = sourceOrder ?? sources.map((s) => s.id);
    const idx = new Map(order.map((id, i) => [id, i + 1]));
    return { claims: cm, sources: sm, sourceNumber: (id) => idx.get(id) ?? 0, open: setOpenIds };
  }, [claims, sources, sourceOrder]);

  const shown = (openIds ?? []).map((id) => value.claims[id]).filter(Boolean);

  return (
    <Ctx.Provider value={value}>
      {children}
      <Sheet open={Boolean(openIds)} onOpenChange={(o) => !o && setOpenIds(null)} title="Sources and evidence" subtitle="External text is shown as evidence only.">
        <div className="space-y-6">
          {shown.length === 0 && <p className="text-sm text-muted">No evidence records were stored for this statement.</p>}
          {shown.map((c) => (
            <div key={c.id} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <ClaimStatusBadge status={c.status} />
                {isStale(c) && (
                  <span className="inline-flex items-center gap-1 text-[12px] text-peach-ink">
                    <AlertTriangle className="h-3 w-3" /> May be out of date
                  </span>
                )}
              </div>
              <p className="text-[15px] font-medium leading-snug text-ink">{c.text}</p>
              <p className="text-[12px] text-muted">
                {c.status_reason}
                {c.reporting_period ? ` · Reporting period: ${c.reporting_period}` : ""}
                {c.verified_at ? ` · Last checked ${fmtDate(c.verified_at)}` : ""}
              </p>
              {c.evidence.map((ev, i) => {
                const s = value.sources[ev.source_id];
                if (!s) return null;
                return (
                  <div key={i} className="rounded-xl border border-line bg-ivory/60 p-3.5">
                    <p className="text-[12px] font-medium text-muted">
                      [{value.sourceNumber(s.id)}] {s.publisher} · {s.source_type.replace("_", " ")}
                    </p>
                    <p className="mt-1 text-sm font-medium text-ink">{s.title}</p>
                    {ev.quote && (
                      <blockquote className={cn("mt-2 border-l-2 pl-3 text-[13px] italic text-ink/75", ev.quote_found ? "border-mint-ink/50" : "border-danger/50")}>
                        “{ev.quote}”
                        {!ev.quote_found && <span className="mt-1 block not-italic text-danger">Passage not found in the retrieved text.</span>}
                      </blockquote>
                    )}
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted">
                      <span>
                        Published {fmtDate(s.published_at)} · Retrieved {fmtDate(s.retrieved_at)}
                      </span>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
                        Open source <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Sheet>
    </Ctx.Provider>
  );
}

export function useCitations() {
  return useContext(Ctx);
}

/** Inline citation markers for a set of claim ids, e.g. ¹ ³. Clicking opens the source drawer. */
export function Cite({ ids, className }: { ids: string[] | undefined; className?: string }) {
  const ctx = useContext(Ctx);
  if (!ctx || !ids?.length) return null;
  const claims = ids.map((id) => ctx.claims[id]).filter(Boolean);
  if (!claims.length) return null;
  const nums = [...new Set(claims.flatMap((c) => c.evidence.map((e) => ctx.sourceNumber(e.source_id))).filter(Boolean))].sort((a, b) => a - b);
  const weakest = claims.some((c) => c.status === "Unverified") ? "Unverified" : claims.some((c) => c.status === "Needs Verification") ? "Needs Verification" : "ok";
  return (
    <button
      type="button"
      onClick={() => ctx.open(ids)}
      className={cn(
        "ml-1 inline-flex translate-y-[-1px] items-center rounded-md px-1 align-baseline text-[11px] font-semibold leading-4 transition-colors",
        weakest === "ok" ? "bg-soft-blue text-accent hover:bg-accent hover:text-white" : weakest === "Unverified" ? "bg-soft-danger text-danger" : "bg-soft-peach text-peach-ink",
        className,
      )}
      aria-label={`View sources (${weakest === "ok" ? "evidenced" : weakest})`}
      title={weakest === "ok" ? "View sources" : `${weakest}: view evidence`}
    >
      {nums.length ? nums.join(",") : "?"}
    </button>
  );
}
