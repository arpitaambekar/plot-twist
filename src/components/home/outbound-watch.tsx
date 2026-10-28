"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, ExternalLink, Plus, Check, Flag } from "lucide-react";
import type { OutboundStat } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Card, EmptyState, Input, Label, Select, Textarea, SectionTitle, Notice } from "@/components/ui/primitives";
import { ClaimStatusBadge } from "@/components/sources/status-badge";
import { useSession } from "@/components/shell/user-context";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import { fmtDate, cn, daysSince } from "@/lib/utils";

const fmtNum = (v: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(v);
const fmtCompact = (v: number) => new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(v);

/** Comparable = same metric, same unit, same reporting period. Nothing else is ever charted together. */
function comparableGroups(stats: OutboundStat[]) {
  const groups = new Map<string, OutboundStat[]>();
  for (const s of stats) {
    if (s.status === "Unverified") continue;
    const key = `${s.metric.toLowerCase()}|${s.unit.toLowerCase()}|${s.reporting_period.toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  return [...groups.values()].filter((g) => new Set(g.map((s) => s.destination)).size >= 2).map((g) => [...g].sort((a, b) => b.value - a.value));
}

export function OutboundWatch({ stats }: { stats: OutboundStat[] }) {
  const { can } = useSession();
  const [metric, setMetric] = useState("All");
  const [adding, setAdding] = useState(false);
  const metrics = useMemo(() => ["All", ...new Set(stats.map((s) => s.metric))], [stats]);
  const shown = metric === "All" ? stats : stats.filter((s) => s.metric === metric);
  const groups = comparableGroups(shown);

  return (
    <section aria-labelledby="outbound-title">
      <SectionTitle
        kicker="India Outbound Watch"
        title="The numbers behind the shift"
        action={
          can("editor") && (
            <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Add a statistic
            </Button>
          )
        }
      />
      <p className="-mt-2 mb-5 max-w-3xl text-[13px] text-muted">
        Every figure carries its metric definition, reporting period, geography and source. Visitor arrivals (counted by a destination), departures (counted by India), bookings and searches measure different things and are never combined or charted together.
      </p>

      {stats.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="h-6 w-6" />}
          title="No sourced statistics yet"
          body="Add official figures (for example, Indian visitor arrivals published by a destination's statistics office) with their source link. Nothing is shown without a source."
          action={can("editor") ? <Button onClick={() => setAdding(true)}>Add a statistic</Button> : undefined}
        />
      ) : (
        <>
          {metrics.length > 2 && (
            <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by metric">
              {metrics.map((m) => (
                <button key={m} role="tab" aria-selected={metric === m} onClick={() => setMetric(m)} className={cn("rounded-full border px-3 py-1 text-[13px]", metric === m ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink/75 hover:border-ink/30")}>
                  {m}
                </button>
              ))}
            </div>
          )}

          {groups.map((g) => (
            <Card key={g[0].id} className="mb-5 p-5">
              <p className="text-[14px] font-semibold text-ink">
                {g[0].metric} · {g[0].reporting_period}
              </p>
              <p className="mb-4 text-[12px] text-muted">Comparable figures only: same metric, unit ({g[0].unit}) and reporting period. Each bar links to its source.</p>
              <div className="space-y-2.5">
                {g.map((s) => (
                  <div key={s.id} className="grid grid-cols-[120px_1fr_auto] items-center gap-3 text-[13px]">
                    <span className="truncate text-ink">{s.destination}</span>
                    <div className="h-2.5 overflow-hidden rounded-full bg-ink/[0.05]">
                      <div className="h-full rounded-full bg-accent/80" style={{ width: `${Math.max(2, (s.value / g[0].value) * 100)}%` }} />
                    </div>
                    <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="tabular-nums font-medium text-ink hover:text-accent" title={`${s.publisher}: ${s.source_title}`}>
                      {fmtCompact(s.value)}
                    </a>
                  </div>
                ))}
              </div>
            </Card>
          ))}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((s) => (
              <StatCard key={s.id} s={s} />
            ))}
          </div>
        </>
      )}
      <AddStatDialog open={adding} onOpenChange={setAdding} />
    </section>
  );
}

function StatCard({ s }: { s: OutboundStat }) {
  const { can } = useSession();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const stale = daysSince(s.verified_at) > 180;
  async function act(action: "confirm" | "flag") {
    setBusy(true);
    try {
      await api(`/api/stats/${s.id}`, { method: "PATCH", json: { action } });
      toast(action === "confirm" ? "Marked as re-checked." : "Flagged as unconfirmed.");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  const maxBar = Math.max(s.value, s.comparison_value ?? 0);
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium text-muted">{s.destination}</p>
          <p className="text-[14px] font-semibold text-ink">{s.metric}</p>
        </div>
        <ClaimStatusBadge status={s.status} />
      </div>
      <p className="mt-3 text-[30px] font-semibold leading-none tracking-[-0.02em] text-ink tabular-nums">
        {fmtNum(s.value)} <span className="text-[14px] font-normal text-muted">{s.unit}</span>
      </p>
      <p className="mt-1 text-[13px] text-ink/80">Reporting period: {s.reporting_period}</p>
      {s.yoy_change_pct !== null && (
        <p className={cn("mt-1 text-[13px] font-medium", s.yoy_change_pct >= 0 ? "text-mint-ink" : "text-danger")}>
          {s.yoy_change_pct >= 0 ? "+" : ""}
          {s.yoy_change_pct}% year on year{s.comparison_period ? ` vs ${s.comparison_period}` : ""}
        </p>
      )}
      {s.comparison_value !== null && s.comparison_period && (
        <div className="mt-3 space-y-1.5 text-[12px]" aria-label="Same metric, same source, two periods">
          {[
            [s.comparison_period, s.comparison_value],
            [s.reporting_period, s.value],
          ].map(([label, v]) => (
            <div key={String(label)} className="grid grid-cols-[90px_1fr_auto] items-center gap-2">
              <span className="truncate text-muted">{label}</span>
              <div className="h-1.5 rounded-full bg-ink/[0.05]">
                <div className="h-full rounded-full bg-ink/60" style={{ width: `${(Number(v) / maxBar) * 100}%` }} />
              </div>
              <span className="tabular-nums text-ink/80">{fmtCompact(Number(v))}</span>
            </div>
          ))}
        </div>
      )}
      <details className="mt-3 text-[12px] text-muted">
        <summary className="cursor-pointer select-none font-medium text-ink/70 hover:text-ink">Definition, geography and notes</summary>
        <p className="mt-2">
          <span className="font-medium text-ink/80">Definition:</span> {s.definition}
        </p>
        <p className="mt-1">
          <span className="font-medium text-ink/80">Geography:</span> {s.geography}
        </p>
        {s.notes && <p className="mt-1">{s.notes}</p>}
      </details>
      <div className="mt-auto border-t border-line pt-3 text-[12px] text-muted">
        <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
          {s.publisher} <ExternalLink className="h-3 w-3" />
        </a>
        <p className="mt-0.5 line-clamp-1">{s.source_title}</p>
        <p className={cn("mt-1", stale && "text-peach-ink")}>
          Last verified {fmtDate(s.verified_at)}
          {stale ? " · may be out of date" : ""}
          {s.created_by === "seed" ? " · seed data from search snippets, open the source to confirm" : ""}
        </p>
        {can("editor") && (
          <div className="mt-2 flex gap-2">
            <button disabled={busy} onClick={() => act("confirm")} className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-ink/80 hover:border-ink/30">
              <Check className="h-3 w-3" /> I checked the source
            </button>
            <button disabled={busy} onClick={() => act("flag")} className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-ink/80 hover:border-danger/40 hover:text-danger">
              <Flag className="h-3 w-3" /> Can&apos;t confirm
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

const EMPTY = {
  metric: "Indian visitor arrivals",
  destination: "",
  value: "",
  unit: "visitors",
  reporting_period: "",
  definition: "",
  geography: "",
  yoy_change_pct: "",
  comparison_value: "",
  comparison_period: "",
  publisher: "",
  source_title: "",
  source_url: "",
  source_type: "government",
  published_date: "",
  notes: "",
};

function AddStatDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [f, setF] = useState(EMPTY);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(/,/g, "")));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api("/api/stats", {
        json: {
          ...f,
          value: num(f.value),
          yoy_change_pct: num(f.yoy_change_pct),
          comparison_value: num(f.comparison_value),
          comparison_period: f.comparison_period || null,
          published_date: f.published_date || null,
          confirmed_in_source: confirmed ? true : undefined,
        },
      });
      toast("Statistic added with its source.");
      setF(EMPTY);
      setConfirmed(false);
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Add an outbound statistic" description="All fields marked * are required. Use the publisher's own definition." wide>
      <form onSubmit={submit} className="space-y-4">
        {err && <Notice tone="danger">{err}</Notice>}
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label htmlFor="s-metric">Metric *</Label>
            <Input id="s-metric" required value={f.metric} onChange={set("metric")} list="metric-options" />
            <datalist id="metric-options">
              <option value="Indian visitor arrivals" />
              <option value="Indian nationals' departures" />
              <option value="Overnight stays by Indian residents" />
              <option value="Weekly direct seats from India" />
            </datalist>
          </div>
          <div>
            <Label htmlFor="s-dest">Destination *</Label>
            <Input id="s-dest" required value={f.destination} onChange={set("destination")} placeholder="e.g. Japan" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="s-val">Value *</Label>
              <Input id="s-val" required inputMode="decimal" value={f.value} onChange={set("value")} />
            </div>
            <div>
              <Label htmlFor="s-unit">Unit *</Label>
              <Input id="s-unit" required value={f.unit} onChange={set("unit")} />
            </div>
          </div>
          <div>
            <Label htmlFor="s-period">Reporting period *</Label>
            <Input id="s-period" required value={f.reporting_period} onChange={set("reporting_period")} placeholder="e.g. 2025 (calendar year)" />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="s-geo">Geography *</Label>
            <Input id="s-geo" required value={f.geography} onChange={set("geography")} placeholder="e.g. Visitors resident in India arriving in Japan" />
          </div>
          <div className="md:col-span-3">
            <Label htmlFor="s-def">Definition *</Label>
            <Textarea id="s-def" required rows={2} value={f.definition} onChange={set("definition")} placeholder="How the publisher defines this figure" />
          </div>
          <div>
            <Label htmlFor="s-yoy" hint="optional">YoY change %</Label>
            <Input id="s-yoy" inputMode="decimal" value={f.yoy_change_pct} onChange={set("yoy_change_pct")} />
          </div>
          <div>
            <Label htmlFor="s-cv" hint="same source & definition">Comparison value</Label>
            <Input id="s-cv" inputMode="decimal" value={f.comparison_value} onChange={set("comparison_value")} />
          </div>
          <div>
            <Label htmlFor="s-cp">Comparison period</Label>
            <Input id="s-cp" value={f.comparison_period} onChange={set("comparison_period")} />
          </div>
          <div>
            <Label htmlFor="s-pub">Publisher *</Label>
            <Input id="s-pub" required value={f.publisher} onChange={set("publisher")} />
          </div>
          <div>
            <Label htmlFor="s-type">Source type *</Label>
            <Select id="s-type" value={f.source_type} onChange={set("source_type")}>
              <option value="government">Government / statistics office</option>
              <option value="tourism_board">Tourism board</option>
              <option value="official">Other official body</option>
              <option value="research">Research</option>
              <option value="trade">Trade press</option>
              <option value="news">News</option>
              <option value="other">Other</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="s-pdate" hint="optional">Published date</Label>
            <Input id="s-pdate" type="date" value={f.published_date} onChange={set("published_date")} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="s-title">Source title *</Label>
            <Input id="s-title" required value={f.source_title} onChange={set("source_title")} />
          </div>
          <div>
            <Label htmlFor="s-url">Source URL *</Label>
            <Input id="s-url" required type="url" value={f.source_url} onChange={set("source_url")} />
          </div>
          <div className="md:col-span-3">
            <Label htmlFor="s-notes" hint="optional">Notes and caveats</Label>
            <Input id="s-notes" value={f.notes} onChange={set("notes")} placeholder="e.g. provisional figures; residence vs nationality" />
          </div>
        </div>
        <label className="flex items-start gap-2 text-[13px] text-ink">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#4169D7]" required />
          I opened the source and the figure, period and definition match it.
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Add statistic
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
