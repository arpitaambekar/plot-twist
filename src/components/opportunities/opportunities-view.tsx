"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, KanbanSquare, List, Search } from "lucide-react";
import { STAGES, type Opportunity, type Stage } from "@/lib/types";
import type { ReadinessStatus } from "@/lib/opportunities/readiness";
import { EmptyState, Input, Label, PageHeader, Select } from "@/components/ui/primitives";
import { useSession } from "@/components/shell/user-context";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import { cn, fmtDate, timeAgo } from "@/lib/utils";
import { NewOpportunity } from "./new-opportunity";
import { PriorityDot, READINESS_ORDER, ReadinessBadge, ReadinessBar } from "./readiness-badge";

interface RSummary {
  status: ReadinessStatus;
  pct: number;
  completed: number;
  total: number;
  next: string | null;
}

type SortKey = "name" | "destination" | "stage" | "priority" | "next_action_date" | "updated_at" | "readiness";
const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 };

export function OpportunitiesView({
  opportunities,
  readiness,
  owners,
  destinations,
}: {
  opportunities: Opportunity[];
  readiness: Record<string, RSummary>;
  owners: string[];
  destinations: { name: string; board: string | null }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const { can } = useSession();
  const [items, setItems] = useState(opportunities);
  const [view, setView] = useState<"table" | "board">("table");
  const [q, setQ] = useState("");
  const [f, setF] = useState({ stage: "", priority: "", owner: "", destination: "", readiness: "" });
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "updated_at", asc: false });

  useEffect(() => setItems(opportunities), [opportunities]);
  useEffect(() => {
    try {
      const v = localStorage.getItem("pt.opps.view");
      if (v === "board" || v === "table") setView(v);
    } catch {}
  }, []);
  function switchView(v: "table" | "board") {
    setView(v);
    try {
      localStorage.setItem("pt.opps.view", v);
    } catch {}
  }

  async function moveStage(id: string, stage: Stage) {
    const prev = items;
    setItems((xs) => xs.map((o) => (o.id === id ? { ...o, stage } : o)));
    try {
      await api(`/api/opportunities/${id}`, { method: "PATCH", json: { stage } });
      toast(`Moved to ${stage}.`);
      router.refresh();
    } catch (e) {
      setItems(prev);
      toast((e as Error).message, "error");
    }
  }

  const allOwners = useMemo(() => [...new Set([...owners, ...items.map((o) => o.owner).filter(Boolean) as string[]])].sort(), [owners, items]);
  const allDest = useMemo(() => [...new Set(items.map((o) => o.destination))].sort(), [items]);

  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    const rows = items.filter((o) => {
      if (needle && !`${o.name} ${o.destination} ${o.tourism_board ?? ""} ${o.summary} ${o.next_action ?? ""}`.toLowerCase().includes(needle)) return false;
      if (f.stage && o.stage !== f.stage) return false;
      if (f.priority && o.priority !== f.priority) return false;
      if (f.owner && (o.owner ?? "") !== f.owner) return false;
      if (f.destination && o.destination !== f.destination) return false;
      if (f.readiness && readiness[o.id]?.status !== f.readiness) return false;
      return true;
    });
    const val = (o: Opportunity): string | number => {
      switch (sort.key) {
        case "stage":
          return STAGES.indexOf(o.stage);
        case "priority":
          return PRIORITY_RANK[o.priority];
        case "readiness":
          return readiness[o.id]?.pct ?? 0;
        case "next_action_date":
          return o.next_action_date ?? "9999";
        default:
          return String(o[sort.key] ?? "").toLowerCase();
      }
    };
    return rows.sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      return (av < bv ? -1 : av > bv ? 1 : 0) * (sort.asc ? 1 : -1);
    });
  }, [items, q, f, sort, readiness]);

  const header = (key: SortKey, label: string, className?: string) => (
    <th className={cn("px-4 py-3 text-left font-medium", className)} aria-sort={sort.key === key ? (sort.asc ? "ascending" : "descending") : "none"}>
      <button className="inline-flex items-center gap-1 hover:text-ink" onClick={() => setSort((s) => ({ key, asc: s.key === key ? !s.asc : key !== "updated_at" }))}>
        {label}
        {sort.key === key && (sort.asc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  );

  return (
    <div>
      <PageHeader eyebrow="What's Next?" title="Keep the good ideas moving." subtitle="From the first insight to the next big partnership." actions={can("editor") ? <NewOpportunity destinations={destinations} /> : undefined} />

      <div className="mb-3 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search opportunities…" className="pl-9" aria-label="Search opportunities" />
        </div>
        <div className="inline-flex shrink-0 rounded-full border border-line bg-surface p-0.5" role="tablist" aria-label="View">
          <button role="tab" aria-selected={view === "table"} onClick={() => switchView("table")} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm", view === "table" ? "bg-ink text-white" : "text-ink/70")}>
            <List className="h-4 w-4" /> Table
          </button>
          <button role="tab" aria-selected={view === "board"} onClick={() => switchView("board")} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm", view === "board" ? "bg-ink text-white" : "text-ink/70")}>
            <KanbanSquare className="h-4 w-4" /> Board
          </button>
        </div>
      </div>
      <div className="mb-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Filter label="Stage" value={f.stage} options={[...STAGES]} onChange={(v) => setF({ ...f, stage: v })} />
          <Filter label="Priority" value={f.priority} options={["High", "Medium", "Low"]} onChange={(v) => setF({ ...f, priority: v })} />
          <Filter label="Owner" value={f.owner} options={allOwners} onChange={(v) => setF({ ...f, owner: v })} />
          <Filter label="Destination" value={f.destination} options={allDest} onChange={(v) => setF({ ...f, destination: v })} />
          <Filter label="Readiness" value={f.readiness} options={READINESS_ORDER} onChange={(v) => setF({ ...f, readiness: v })} />
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<KanbanSquare className="h-8 w-8" />}
          title="No opportunities yet."
          body="Save one from a news story, a research report, a campaign or a contact, or create one here."
          action={can("editor") ? <NewOpportunity destinations={destinations} /> : undefined}
        />
      ) : view === "table" ? (
        <div className="overflow-x-auto rounded-[14px] border border-line bg-surface">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="border-b border-line text-[12px] text-muted">
              <tr>
                {header("name", "Opportunity")}
                {header("stage", "Stage")}
                {header("priority", "Priority")}
                {header("readiness", "Pitch readiness", "w-56")}
                {header("next_action_date", "Next action")}
                <th className="px-4 py-3 text-left font-medium">Owner</th>
                {header("updated_at", "Updated")}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((o) => {
                const r = readiness[o.id];
                const overdue = o.next_action_date && o.next_action_date < new Date().toISOString().slice(0, 10);
                return (
                  <tr key={o.id} className="align-top hover:bg-ivory/60">
                    <td className="px-4 py-3.5">
                      <Link href={`/opportunities/${o.id}`} className="font-medium text-ink hover:text-accent">
                        {o.name}
                      </Link>
                      <p className="text-[12px] text-muted">
                        {o.destination}
                        {o.tourism_board ? ` · ${o.tourism_board}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      {can("editor") ? (
                        <Select value={o.stage} onChange={(e) => moveStage(o.id, e.target.value as Stage)} className="h-8 w-44 text-[13px]" aria-label={`Stage for ${o.name}`}>
                          {STAGES.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </Select>
                      ) : (
                        o.stage
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5">
                        <PriorityDot priority={o.priority} /> {o.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {r && (
                        <div className="space-y-1.5">
                          <ReadinessBadge status={r.status} />
                          <ReadinessBar pct={r.pct} />
                          <p className="text-[11px] text-muted">
                            {r.completed}/{r.total} criteria
                          </p>
                        </div>
                      )}
                    </td>
                    <td className="max-w-[240px] px-4 py-3.5">
                      {o.next_action ? (
                        <>
                          <p className="line-clamp-2 text-ink">{o.next_action}</p>
                          {o.next_action_date && <p className={cn("text-[12px]", overdue ? "font-medium text-danger" : "text-muted")}>{overdue ? "Overdue · " : ""}{fmtDate(o.next_action_date)}</p>}
                        </>
                      ) : (
                        <p className="text-[12px] text-muted">{r?.next ? `Suggested: ${r.next}` : "None set"}</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-ink/80">{o.owner ?? <span className="text-muted">Unassigned</span>}</td>
                    <td className="px-4 py-3.5 text-[12px] text-muted">{timeAgo(o.updated_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">No opportunities match these filters.</p>}
        </div>
      ) : (
        <Board items={filtered} readiness={readiness} canEdit={can("editor")} onMove={moveStage} />
      )}
    </div>
  );
}

function Filter({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (v: string) => void }) {
  const id = `of-${label.toLowerCase()}`;
  return (
    <div>
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 text-[13px]">
        <option value="">{label}: all</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Select>
    </div>
  );
}

function Board({ items, readiness, canEdit, onMove }: { items: Opportunity[]; readiness: Record<string, RSummary>; canEdit: boolean; onMove: (id: string, s: Stage) => void }) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  return (
    <div className="scrollbar-thin -mx-4 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8">
      <div className="flex gap-3" style={{ minWidth: STAGES.length * 268 }}>
        {STAGES.map((stage) => {
          const col = items.filter((o) => o.stage === stage);
          return (
            <section
              key={stage}
              aria-label={stage}
              onDragOver={(e) => {
                if (!canEdit) return;
                e.preventDefault();
                setOver(stage);
              }}
              onDragLeave={() => setOver((s) => (s === stage ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                setOver(null);
                setDragging(null);
                const o = items.find((x) => x.id === id);
                if (o && o.stage !== stage) onMove(id, stage);
              }}
              className={cn("flex w-64 shrink-0 flex-col rounded-[14px] border border-line bg-ivory/70 p-2.5 transition-colors", over === stage && "border-accent/40 bg-soft-blue/60")}
            >
              <header className="mb-2 flex items-center justify-between px-1.5 py-1">
                <h3 className="text-[13px] font-semibold text-ink">{stage}</h3>
                <span className="text-[12px] text-muted">{col.length}</span>
              </header>
              <div className="flex min-h-24 flex-col gap-2">
                {col.map((o) => {
                  const r = readiness[o.id];
                  return (
                    <article
                      key={o.id}
                      draggable={canEdit}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", o.id);
                        setDragging(o.id);
                      }}
                      onDragEnd={() => setDragging(null)}
                      className={cn("rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-card)]", canEdit && "cursor-grab active:cursor-grabbing", dragging === o.id && "opacity-50")}
                    >
                      <Link href={`/opportunities/${o.id}`} className="block text-[14px] font-medium leading-snug text-ink hover:text-accent">
                        {o.name}
                      </Link>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
                        <PriorityDot priority={o.priority} /> {o.destination}
                        {o.owner ? ` · ${o.owner}` : ""}
                      </p>
                      {r && (
                        <div className="mt-2.5 space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-muted">
                            <span>{r.status}</span>
                            <span>
                              {r.completed}/{r.total}
                            </span>
                          </div>
                          <ReadinessBar pct={r.pct} />
                        </div>
                      )}
                      {o.next_action && <p className="mt-2 line-clamp-2 text-[12px] text-ink/75">Next: {o.next_action}</p>}
                      {canEdit && (
                        <Select value={o.stage} onChange={(e) => onMove(o.id, e.target.value as Stage)} className="mt-2.5 h-8 text-[12px]" aria-label={`Move ${o.name} to stage`}>
                          {STAGES.map((s) => (
                            <option key={s} value={s}>
                              {s === o.stage ? `Stage: ${s}` : `Move to ${s}`}
                            </option>
                          ))}
                        </Select>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
