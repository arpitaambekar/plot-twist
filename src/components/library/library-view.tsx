"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Plus, RefreshCw, Search, Sparkles, X, Pencil, Trash2, Library } from "lucide-react";
import type { AuditEntry, ReferenceCampaign } from "@/lib/types";
import { Badge, Card, EmptyState, Input, Select, Notice } from "@/components/ui/primitives";
import { Button, buttonClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Photo } from "@/components/media/photo";
import { SaveButton } from "@/components/shared/save-button";
import { ClaimStatusBadge, KindLabel } from "@/components/sources/status-badge";
import { useSession } from "@/components/shell/user-context";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import { cn, fmtDate, fmtDateTime } from "@/lib/utils";
import { CAMPAIGN_TYPES, ReferenceForm } from "./reference-form";

const yearOf = (d: string | null) => (d ? d.slice(0, 4) : null);

export function LibraryView({ items: initial, savedIds, initialRef, seedDate }: { items: ReferenceCampaign[]; savedIds: string[]; initialRef: string | null; seedDate: string }) {
  const router = useRouter();
  const { can } = useSession();
  const toast = useToast();
  const [items, setItems] = useState(initial);
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");
  const [board, setBoard] = useState("");
  const [year, setYear] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(initialRef);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => setItems(initial), [initial]);

  const countries = useMemo(() => [...new Set(items.map((i) => i.destination))].sort(), [items]);
  const boards = useMemo(() => [...new Set(items.map((i) => i.tourism_board))].sort(), [items]);
  const years = useMemo(() => [...new Set(items.map((i) => yearOf(i.launch_date)).filter(Boolean) as string[])].sort().reverse(), [items]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items
      .filter((i) => !country || i.destination === country)
      .filter((i) => !board || i.tourism_board === board)
      .filter((i) => !year || yearOf(i.launch_date) === year)
      .filter((i) => types.every((t) => i.campaign_types.includes(t)))
      .filter((i) => !needle || [i.name, i.tourism_board, i.destination, i.creative_idea, i.insight, i.channels.join(" ")].join(" ").toLowerCase().includes(needle))
      .sort((a, b) => (b.launch_date ?? "").localeCompare(a.launch_date ?? ""));
  }, [items, q, country, board, year, types]);

  const open = items.find((i) => i.id === openId) ?? null;
  const filtersOn = Boolean(q || country || board || year || types.length);

  function setOpen(id: string | null) {
    setOpenId(id);
    const url = id ? `/library?ref=${encodeURIComponent(id)}` : "/library";
    window.history.replaceState(null, "", url);
  }

  function clear() {
    setQ("");
    setCountry("");
    setBoard("");
    setYear("");
    setTypes([]);
  }

  async function create(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const r = await api<{ item: ReferenceCampaign }>("/api/library", { json: payload });
      setItems((x) => [r.item, ...x]);
      setAdding(false);
      setOpen(r.item.id);
      toast("Reference added. It stays “Needs Verification” until checked.");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-6 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search campaigns, boards, mechanics…" className="h-11 rounded-full pl-10" aria-label="Search the library" />
          </div>
          <div className="grid grid-cols-3 gap-2 lg:w-[480px]">
            <Select value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Filter by country">
              <option value="">All countries</option>
              {countries.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
            <Select value={board} onChange={(e) => setBoard(e.target.value)} aria-label="Filter by tourism board">
              <option value="">All boards</option>
              {boards.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
            <Select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Filter by year">
              <option value="">Any year</option>
              {years.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </div>
          {can("editor") && (
            <Button variant="secondary" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Add reference
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Campaign type">
          {CAMPAIGN_TYPES.map((t) => {
            const on = types.includes(t);
            const count = items.filter((i) => i.campaign_types.includes(t)).length;
            return (
              <button
                key={t}
                aria-pressed={on}
                onClick={() => setTypes(on ? types.filter((x) => x !== t) : [...types, t])}
                className={cn(
                  "rounded-full border px-3 py-1 text-[13px] transition-colors",
                  on ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink/75 hover:border-ink/25",
                  !count && !on && "opacity-50",
                )}
              >
                {t} <span className={cn("ml-0.5 tabular-nums", on ? "text-white/70" : "text-muted")}>{count}</span>
              </button>
            );
          })}
          {filtersOn && (
            <button onClick={clear} className="ml-1 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
              <X className="h-3.5 w-3.5" /> Clear filters
            </button>
          )}
        </div>
        <p className="text-[13px] text-muted">
          {filtered.length} of {items.length} reference campaigns
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<Library className="h-8 w-8" />} title="The library is empty." body="Add a real campaign with at least one source to start the collection." />
      ) : filtered.length === 0 ? (
        <EmptyState title="No campaigns match these filters." body="Try fewer campaign types or clear the filters." action={<Button variant="secondary" onClick={clear}>Clear filters</Button>} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <Card key={r.id} className="group flex flex-col overflow-hidden transition-shadow hover:shadow-[var(--shadow-lift)]">
              <button onClick={() => setOpen(r.id)} className="text-left" aria-label={`Open ${r.name}`}>
                <div className="relative">
                  <Photo image={r.image} label={r.destination} className="aspect-[16/9]" />
                  <div className="absolute left-3 top-3">
                    <ClaimStatusBadge status={r.verification} className="bg-surface/95 shadow-sm" />
                  </div>
                </div>
              </button>
              <div className="flex flex-1 flex-col p-5">
                <p className="text-[12px] text-muted">
                  {r.tourism_board} · {r.launch_date ? fmtDate(r.launch_date.length === 4 ? `${r.launch_date}-01-01` : `${r.launch_date}-01`, r.launch_date.length === 4 ? { year: "numeric" } : { month: "short", year: "numeric" }) : "Date not stated"}
                </p>
                <button onClick={() => setOpen(r.id)} className="mt-1 text-left">
                  <h3 className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ink group-hover:text-accent">{r.name}</h3>
                </button>
                <p className="mt-2 line-clamp-3 text-sm text-ink/75">{r.creative_idea}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {r.campaign_types.slice(0, 3).map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                  <Link href={`/studio?reference=${encodeURIComponent(r.id)}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline">
                    <Sparkles className="h-3.5 w-3.5" /> Use as inspiration
                  </Link>
                  <SaveButton type="reference" id={r.id} label={r.name} initial={savedIds.includes(r.id)} className="border border-line" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {open && (
        <ReferenceDetail
          key={open.id}
          item={open}
          saved={savedIds.includes(open.id)}
          seedDate={seedDate}
          onClose={() => setOpen(null)}
          onChange={(updated) => setItems((x) => x.map((i) => (i.id === updated.id ? { ...updated, image: updated.image ?? i.image } : i)))}
          onDelete={(id) => {
            setItems((x) => x.filter((i) => i.id !== id));
            setOpen(null);
          }}
        />
      )}
      {!open && openId && initialRef === openId && (
        <Dialog open onOpenChange={() => setOpen(null)} title="Reference not found">
          <p className="text-sm text-muted">This campaign may have been removed from the library.</p>
        </Dialog>
      )}

      <Dialog open={adding} onOpenChange={setAdding} title="Add a reference campaign" description="Only real campaigns with at least one supporting source. New entries start as “Needs Verification”." wide>
        <ReferenceForm onSubmit={create} busy={busy} submitLabel="Add to library" />
      </Dialog>
    </div>
  );
}

function ReferenceDetail({
  item,
  saved,
  seedDate,
  onClose,
  onChange,
  onDelete,
}: {
  item: ReferenceCampaign;
  saved: boolean;
  seedDate: string;
  onClose: () => void;
  onChange: (r: ReferenceCampaign) => void;
  onDelete: (id: string) => void;
}) {
  const { can } = useSession();
  const toast = useToast();
  const [checks, setChecks] = useState<AuditEntry[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    api<{ checks: AuditEntry[] }>(`/api/library/${encodeURIComponent(item.id)}`)
      .then((r) => setChecks(r.checks))
      .catch(() => setChecks([]));
  }, [item.id, item.verified_at]);

  const isSeed = item.verified_at === seedDate;
  const last = checks[0];
  const explanation = isSeed
    ? `Added on ${fmtDate(seedDate)} from web-search evidence. The source pages themselves were not opened, so treat details as unconfirmed until someone opens the sources or runs Re-verify.`
    : last
      ? String(last.meta.reason ?? "")
      : item.verification === "Needs Verification"
        ? "Added manually. Run Re-verify to look for supporting evidence."
        : `Last checked ${fmtDate(item.verified_at)}.`;

  async function reverify() {
    setVerifying(true);
    try {
      const r = await api<{ item: ReferenceCampaign; result: { status: string; reason: string; demo: boolean } }>(`/api/library/${encodeURIComponent(item.id)}/verify`, { method: "POST" });
      onChange(r.item);
      toast(r.result.demo ? "Demo fixtures are on, so the status was not changed." : `Check complete: ${r.result.status}.`, r.result.demo ? "info" : "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setVerifying(false);
    }
  }

  async function save(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const r = await api<{ item: ReferenceCampaign }>(`/api/library/${encodeURIComponent(item.id)}`, { method: "PATCH", json: payload });
      onChange(r.item);
      setEditing(false);
      toast("Reference updated.");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api(`/api/library/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      onDelete(item.id);
      toast("Reference deleted.", "info");
    } catch (e) {
      toast((e as Error).message, "error");
      setBusy(false);
    }
  }

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <p className="eyebrow mb-1 !text-[11px]">{label}</p>
      <div className="text-sm leading-relaxed text-ink/85">{children}</div>
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={editing ? `Edit: ${item.name}` : item.name} description={`${item.tourism_board} · ${item.destination} · ${item.launch_date ?? "Launch date not stated"}`} wide>
      {editing ? (
        <ReferenceForm initial={item} onSubmit={save} busy={busy} submitLabel="Save changes" />
      ) : (
        <div className="space-y-6">
          {item.image && <Photo image={item.image} label={item.destination} className="aspect-[21/8] rounded-xl" attribution="none" />}
          {item.image?.is_destination_photo && (
            <p className="-mt-4 text-[11px] text-muted">
              Destination photo of {item.destination}, not campaign creative. {[item.image.author, item.image.license, item.image.provider].filter(Boolean).join(" · ")}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/studio?reference=${encodeURIComponent(item.id)}`} className={buttonClasses("primary", "md")}>
              <Sparkles className="h-4 w-4" /> Use as Inspiration
            </Link>
            <SaveButton type="reference" id={item.id} label={item.name} initial={saved} variant="button" />
            {item.official_link && (
              <a href={item.official_link} target="_blank" rel="noopener noreferrer" className={buttonClasses("secondary", "md")}>
                Official campaign <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            {can("editor") && (
              <Button variant="secondary" onClick={reverify} loading={verifying}>
                <RefreshCw className="h-4 w-4" /> Re-verify
              </Button>
            )}
            {can("admin") && (
              <>
                <Button variant="ghost" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
                <Button variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </>
            )}
          </div>
          <p className="text-[12px] text-muted">Use as Inspiration sends the mechanism and learning to Campaign Studio, which writes a new, original execution. It never copies this campaign.</p>

          {confirmDelete && (
            <Notice
              tone="danger"
              title="Delete this reference permanently?"
              action={
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" variant="danger" onClick={remove} loading={busy}>
                    Delete
                  </Button>
                </div>
              }
            >
              Saved bookmarks to it will stop resolving.
            </Notice>
          )}

          <div className="rounded-xl border border-line bg-ivory/60 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <ClaimStatusBadge status={item.verification} />
              <span className="text-[12px] text-muted">{isSeed ? `Seeded ${fmtDate(seedDate)}` : `Last checked ${fmtDateTime(item.verified_at)}`}</span>
            </div>
            <p className="mt-2 text-[13px] text-ink/80">{explanation}</p>
            {last && last.meta.demo === true && <p className="mt-1 text-[12px] text-danger">The most recent check ran on demo fixtures and did not change the status.</p>}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Objective">{item.objective || "Not stated in sources."}</Field>
            <Field label="Insight">{item.insight || "Not stated in sources."}</Field>
            <Field label="Main creative idea">{item.creative_idea || "Not stated in sources."}</Field>
            <Field label="Participation mechanism">{item.participation_mechanism || "Not stated in sources."}</Field>
            <div className="md:col-span-2">
              <Field label="Execution">{item.execution || "Not stated in sources."}</Field>
            </div>
            <Field label="Target audience">{item.target_audience || "Not stated in sources."}</Field>
            <Field label="Channels">
              <div className="flex flex-wrap gap-1">
                {item.channels.length ? item.channels.map((c) => <Badge key={c}>{c}</Badge>) : "Not stated in sources."}
              </div>
            </Field>
            <Field label="Campaign type">
              <div className="flex flex-wrap gap-1">
                {item.campaign_types.length ? item.campaign_types.map((c) => <Badge key={c} tone="blue">{c}</Badge>) : "Not classified."}
              </div>
            </Field>
            <Field label="Published results">{item.published_results ?? "No published results found."}</Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-soft-blue/60 p-4">
              <KindLabel kind="interpretation" />
              <p className="mt-2 text-[13px] font-medium text-ink">Strategic learning</p>
              <p className="mt-1 text-sm text-ink/80">{item.strategic_learning || "Not written yet."}</p>
            </div>
            <div className="rounded-xl bg-soft-blue/60 p-4">
              <KindLabel kind="interpretation" />
              <p className="mt-2 text-[13px] font-medium text-ink">Relevance to Scapia</p>
              <p className="mt-1 text-sm text-ink/80">{item.scapia_relevance || "Not written yet."}</p>
            </div>
          </div>

          <div>
            <p className="eyebrow mb-2 !text-[11px]">Supporting sources</p>
            <ol className="space-y-2">
              {item.sources.map((s, i) => (
                <li key={s.url} className="flex items-start gap-3 rounded-xl border border-line p-3">
                  <span className="mt-0.5 text-[12px] font-semibold text-accent">[{i + 1}]</span>
                  <div className="min-w-0 flex-1">
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-ink hover:text-accent hover:underline">
                      {s.title}
                    </a>
                    <p className="text-[12px] text-muted">
                      {s.publisher || "Publisher not stated"} · {s.published ? fmtDate(s.published) : "Publication date not stated"}
                    </p>
                  </div>
                  <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted" />
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </Dialog>
  );
}
