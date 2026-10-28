"use client";
import { ShieldCheck } from "lucide-react";
import type { ReportBundle } from "@/lib/research/service";
import { useCitations } from "@/components/sources/citations";
import { ClaimStatusBadge } from "@/components/sources/status-badge";
import { isStale } from "@/lib/freshness";
import { fmtDate } from "@/lib/utils";

/** Health is calculated from stored evidence only; nothing here is AI-estimated. */
export function HealthPanel({ bundle, compact }: { bundle: ReportBundle; compact?: boolean }) {
  const h = bundle.health;
  const cite = useCitations();
  const stale = bundle.claims.filter((c) => isStale(c));
  const unresolved = bundle.claims.filter((c) => c.status === "Needs Verification" || c.status === "Unverified");
  if (!h) return null;
  const tone = h.evidence_pct >= 80 ? "bg-mint-ink" : h.evidence_pct >= 60 ? "bg-accent" : "bg-peach-ink";
  return (
    <div className="rounded-[16px] border border-line bg-surface p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-mint-ink" />
        <p className="text-[13px] font-semibold text-ink">Research health</p>
      </div>
      <p className="mt-3 text-[34px] font-semibold leading-none tracking-[-0.03em] text-ink">{h.evidence_pct}%</p>
      <p className="mt-1 text-[12px] text-muted">
        of {h.total_claims} factual claims have a supporting passage found in the source text
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/[0.06]" aria-hidden>
        <div className={`h-full ${tone}`} style={{ width: `${h.evidence_pct}%` }} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2.5 text-[12px]">
        <Stat k="Verified" v={h.by_status.Verified} />
        <Stat k="Corroborated" v={h.by_status.Corroborated} />
        <Stat k="Needs verification" v={h.by_status["Needs Verification"]} />
        <Stat k="Unverified (held back)" v={h.by_status.Unverified} />
        <Stat k="Unresolved" v={h.unresolved_claims} />
        <Stat k="Potentially stale" v={stale.length} />
        <Stat k="Cited sources" v={h.source_count} />
        <Stat k="Official sources" v={h.official_source_count} />
      </dl>
      <p className="mt-4 text-[11px] text-muted">
        Last updated {fmtDate(bundle.report.updated_at)} · computed {fmtDate(h.computed_at)}
      </p>
      {!compact && unresolved.length > 0 && (
        <details className="mt-4 border-t border-line pt-3">
          <summary className="cursor-pointer text-[13px] font-medium text-ink">Statements needing verification ({unresolved.length})</summary>
          <p className="mt-2 text-[12px] text-muted">Unverified statements are not shown in the report body. They are listed here so a person can check them.</p>
          <ul className="mt-3 space-y-2.5">
            {unresolved.map((c) => (
              <li key={c.id} className="text-[13px]">
                <div className="flex flex-wrap items-center gap-2">
                  <ClaimStatusBadge status={c.status} />
                  <span className="text-[11px] text-muted">{c.section}</span>
                </div>
                <button onClick={() => cite?.open([c.id])} className="mt-1 text-left text-ink/85 hover:text-accent">
                  {c.text}
                </button>
                <p className="text-[11px] text-muted">{c.status_reason}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Stat({ k, v }: { k: string; v: number }) {
  return (
    <div>
      <dt className="text-muted">{k}</dt>
      <dd className="text-[15px] font-semibold tabular-nums text-ink">{v}</dd>
    </div>
  );
}
