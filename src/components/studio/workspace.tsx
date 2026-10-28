"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Sparkles, AlertCircle, RefreshCw, Columns3, GitMerge, X, FileText, Library, Loader2, Check } from "lucide-react";
import type { CampaignIdea } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, Notice, Skeleton } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/dialog";
import { DemoBadge } from "@/components/sources/status-badge";
import { AddToOpportunity } from "@/components/shared/add-to-opportunity";
import { useSession } from "@/components/shell/user-context";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import { cn, fmtDate, fmtDateTime } from "@/lib/utils";
import { IdeaCard, type CardAction } from "./idea-card";
import { CompareDialog } from "./compare-dialog";
import { ExtrasPanel } from "./extras";
import { IdeaEditor } from "./idea-editor";
import type { WorkspaceData } from "./types";

type Tab = "concepts" | "in_app" | "short_form" | "long_form" | "hero_ideas";
type Filter = "all" | "shortlisted" | "draft" | "rejected";

export function Workspace({ setId }: { setId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const ideaParam = params.get("idea");
  const toast = useToast();
  const { can } = useSession();
  const canEdit = can("editor");

  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("concepts");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [combineIds, setCombineIds] = useState<[string, string] | null>(null);
  const [combining, setCombining] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenPick, setRegenPick] = useState<string[]>([]);
  const [regenBusy, setRegenBusy] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState<CampaignIdea | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<WorkspaceData>(`/api/campaigns/${setId}`));
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, [setId]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while the generation job is running (status lives in the database).
  useEffect(() => {
    if (data?.set.status !== "generating") return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [data?.set.status, load]);

  const ideas = useMemo(() => data?.ideas ?? [], [data]);
  const filtered = ideas.filter((i) => (filter === "all" ? true : filter === "shortlisted" ? i.status === "shortlisted" || i.status === "approved" : i.status === filter));
  const pitchFor = (id: string) => data?.pitches.find((p) => p.idea_id === id);
  const newerResearch = data?.report && data.set.report_version !== null && data.report.version > (data.set.report_version ?? 0);
  const staleIdeas = ideas.filter((i) => data?.report && i.report_version !== null && i.report_version < data.report.version);

  function openIdea(id: string) {
    router.push(`/studio/${setId}?idea=${id}`, { scroll: true });
  }

  function replaceIdea(idea: CampaignIdea) {
    setData((d) => (d ? { ...d, ideas: d.ideas.some((x) => x.id === idea.id) ? d.ideas.map((x) => (x.id === idea.id ? idea : x)) : [...d.ideas, idea] } : d));
  }

  async function patchStatus(idea: CampaignIdea, status: CampaignIdea["status"]) {
    try {
      const r = await api<{ idea: CampaignIdea }>(`/api/ideas/${idea.id}`, { method: "PATCH", json: { status } });
      replaceIdea(r.idea);
      toast(status === "shortlisted" ? "Shortlisted. One for the story." : status === "rejected" ? "Rejected. You can restore it any time." : "Moved back to drafts.", status === "rejected" ? "info" : "success");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function withBusy<T>(id: string, fn: () => Promise<T>) {
    setBusyIds((b) => [...b, id]);
    try {
      return await fn();
    } finally {
      setBusyIds((b) => b.filter((x) => x !== id));
    }
  }

  async function act(idea: CampaignIdea, a: CardAction) {
    switch (a) {
      case "open":
      case "edit":
        return openIdea(idea.id);
      case "shortlist":
        return patchStatus(idea, idea.status === "shortlisted" || idea.status === "approved" ? "draft" : "shortlisted");
      case "reject":
        return patchStatus(idea, "rejected");
      case "restore":
        return patchStatus(idea, "draft");
      case "duplicate":
        return withBusy(idea.id, async () => {
          try {
            const r = await api<{ idea: CampaignIdea }>(`/api/ideas/${idea.id}/duplicate`, { method: "POST" });
            replaceIdea(r.idea);
            toast("Duplicated. The copy is at the end of the list.");
          } catch (e) {
            toast((e as Error).message, "error");
          }
        });
      case "regenerate":
        return setConfirmRegen(idea);
      case "compare":
        setSelected((s) => (s.includes(idea.id) ? s : [...s, idea.id].slice(-4)));
        return toast("Added to comparison. Pick 2 to 4 concepts, then Compare.", "info");
      case "combine":
        setSelected((s) => (s.includes(idea.id) ? s : [...s, idea.id].slice(-2)));
        return toast("Pick a second shortlisted concept, then Combine.", "info");
      case "pitch":
        return withBusy(idea.id, async () => {
          try {
            toast("Developing the pitch. This takes a minute.", "info");
            const r = await api<{ pitch: { id: string } }>("/api/pitches", { json: { idea_id: idea.id } });
            router.push(`/studio/${setId}/pitch/${r.pitch.id}`);
          } catch (e) {
            toast((e as Error).message, "error");
          }
        });
      case "open-pitch": {
        const p = pitchFor(idea.id);
        if (p) router.push(`/studio/${setId}/pitch/${p.id}`);
        return;
      }
      case "opportunity":
        setSelected([idea.id]);
        return toast("Use “Add to Opportunity” in the selection bar below.", "info");
    }
  }

  async function regenerate(idea: CampaignIdea) {
    setConfirmRegen(null);
    await withBusy(idea.id, async () => {
      try {
        const r = await api<{ idea: CampaignIdea }>(`/api/ideas/${idea.id}/regenerate`, { method: "POST" });
        replaceIdea(r.idea);
        toast("Regenerated. Your edited fields were kept, and the previous version is in history.");
      } catch (e) {
        toast((e as Error).message, "error");
      }
    });
  }

  async function combine(ids: [string, string]) {
    setCombining(true);
    try {
      const r = await api<{ idea: CampaignIdea }>("/api/ideas/combine", { json: { idea_ids: ids } });
      replaceIdea(r.idea);
      setCombineIds(null);
      setCompareOpen(false);
      setSelected([]);
      toast("Combined into a new concept. The originals are unchanged.");
      openIdea(r.idea.id);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setCombining(false);
    }
  }

  async function regenerateWithLatest() {
    setRegenBusy(true);
    try {
      const r = await api<{ ideas: CampaignIdea[] }>(`/api/campaigns/${setId}/regenerate`, { json: { idea_ids: regenPick, use_latest: true } });
      r.ideas.forEach(replaceIdea);
      toast(`Regenerated ${r.ideas.length} idea(s) with the latest research. Previous versions are in history.`);
      setRegenOpen(false);
      setRegenPick([]);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setRegenBusy(false);
    }
  }

  async function retry() {
    try {
      await api(`/api/campaigns/${setId}/retry`, { method: "POST" });
      await load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  if (loadError) return <EmptyState title="We couldn't open this studio session" body={loadError} action={<Link href="/studio" className="text-sm font-medium text-accent">Back to Campaign Studio</Link>} />;
  if (!data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-96" />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      </div>
    );

  if (ideaParam) {
    return (
      <IdeaEditor
        key={ideaParam}
        ideaId={ideaParam}
        setId={setId}
        latestReportVersion={data.report?.version ?? null}
        onBack={() => router.push(`/studio/${setId}`)}
        onChanged={(idea) => replaceIdea(idea)}
        onOpenIdea={openIdea}
      />
    );
  }

  const { set } = data;
  const selIdeas = selected.map((id) => ideas.find((i) => i.id === id)).filter(Boolean) as CampaignIdea[];
  const bothShortlisted = selIdeas.length === 2 && selIdeas.every((i) => i.status === "shortlisted" || i.status === "approved");
  const brief = set.brief;
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "concepts", label: "Concepts", count: ideas.length },
    { key: "in_app", label: "In-app", count: set.extras?.in_app.length },
    { key: "short_form", label: "Short-form", count: set.extras?.short_form.length },
    { key: "long_form", label: "Long-form", count: set.extras?.long_form.length },
    { key: "hero_ideas", label: "Hero ideas", count: set.extras?.hero_ideas.length },
  ];

  return (
    <div className="pb-24">
      <Link href="/studio" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Campaign Studio
      </Link>
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow mb-2">Plot Something Big · {set.destination}</p>
          <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.02em] text-ink md:text-[34px]">{set.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted">
            {data.report ? (
              <Link href={`/research/${data.report.id}?version=${set.report_version}`} className="inline-flex items-center gap-1 rounded-full bg-soft-mint px-2.5 py-0.5 text-[12px] font-medium text-mint-ink hover:underline">
                <FileText className="h-3 w-3" /> {data.report.destination_name} research v{set.report_version}
              </Link>
            ) : (
              <Badge tone="peach">{set.input_mode === "upload" ? `Upload: ${set.supplied_filename ?? "document"} · not verified` : "Pasted research · not verified"}</Badge>
            )}
            {brief.objective && <Badge tone="neutral">{brief.objective}</Badge>}
            {brief.budget_tier && <Badge tone="neutral">{brief.budget_tier}</Badge>}
            {brief.ambition && <Badge tone="neutral">{brief.ambition}</Badge>}
            {brief.inspiration && (
              <Badge tone="blue">
                <Library className="h-3 w-3" /> Inspired by {brief.inspiration.name}
              </Badge>
            )}
            {set.is_demo && <DemoBadge />}
            <span>Created {fmtDate(set.created_at)}</span>
          </div>
        </div>
      </header>

      {set.status === "generating" && (
        <Card className="mb-6 overflow-hidden">
          <div className="flex flex-col gap-5 p-6 md:flex-row md:items-center">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-soft-blue">
              <Sparkles className="h-5 w-5 animate-soft-pulse text-accent" />
            </div>
            <div className="flex-1">
              <p className="text-[18px] font-semibold text-ink">A little research. A big idea.</p>
              <p className="mt-0.5 text-sm text-muted">{data.job?.log.at(-1)?.message ?? "Starting"}… You can leave this page; generation keeps going.</p>
            </div>
          </div>
          {data.job && (
            <ol className="border-t border-line bg-ivory/50 px-6 py-3 text-[12px] text-muted">
              {data.job.log.slice(-5).map((l, i, arr) => (
                <li key={i} className="flex items-center gap-2 py-0.5">
                  {i === arr.length - 1 ? <Loader2 className="h-3 w-3 animate-spin text-accent" /> : <Check className="h-3 w-3 text-mint-ink" />}
                  {l.message}
                  <span className="ml-auto tabular-nums">{fmtDateTime(l.at)}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      )}

      {set.status === "failed" && (
        <div className="mb-6">
          <Notice tone="danger" title="Generation didn't finish" action={canEdit ? <Button size="sm" onClick={retry}><RefreshCw className="h-3.5 w-3.5" /> Retry</Button> : undefined}>
            {set.error ?? "Something went wrong."} Nothing partial was saved as final; retrying keeps any concepts already created.
          </Notice>
        </div>
      )}
      {set.status === "ready" && set.error && (
        <div className="mb-6">
          <Notice tone="peach" title="Partially complete" action={canEdit ? <Button size="sm" variant="secondary" onClick={retry}><RefreshCw className="h-3.5 w-3.5" /> Retry extras</Button> : undefined}>
            {set.error}
          </Notice>
        </div>
      )}
      {newerResearch && staleIdeas.length > 0 && (
        <div className="mb-6">
          <Notice
            tone="blue"
            title={`Newer research is available (v${data.report!.version})`}
            action={
              canEdit ? (
                <Button size="sm" variant="secondary" onClick={() => { setRegenPick([]); setRegenOpen(true); }}>
                  Regenerate selected ideas
                </Button>
              ) : undefined
            }
          >
            {staleIdeas.length} idea(s) were built on v{set.report_version}. Nothing changes unless you choose to regenerate; your edits stay locked and earlier versions remain in history.
          </Notice>
        </div>
      )}

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-line" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn("-mb-px whitespace-nowrap border-b-2 px-3.5 pb-3 pt-1 text-[14px] transition-colors", tab === t.key ? "border-ink font-medium text-ink" : "border-transparent text-muted hover:text-ink")}
          >
            {t.label}
            {t.count !== undefined && <span className="ml-1.5 text-[12px] text-muted">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === "concepts" ? (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {(["all", "shortlisted", "draft", "rejected"] as Filter[]).map((f) => {
              const count = f === "all" ? ideas.length : ideas.filter((i) => (f === "shortlisted" ? i.status === "shortlisted" || i.status === "approved" : i.status === f)).length;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className={cn("rounded-full border px-3 py-1 text-[13px] capitalize transition-colors", filter === f ? "border-ink bg-ink text-white" : "border-line text-ink/75 hover:border-ink/30")}
                >
                  {f === "draft" ? "Drafts" : f} <span className="opacity-70">{count}</span>
                </button>
              );
            })}
            <span className="ml-auto text-[12px] text-muted">Tick cards to compare, combine or add to an opportunity.</span>
          </div>
          {set.status === "generating" && !ideas.length ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-80" />
              ))}
            </div>
          ) : filtered.length ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  index={ideas.indexOf(idea)}
                  selected={selected.includes(idea.id)}
                  saved={data.saved_ids.includes(idea.id)}
                  hasPitch={Boolean(pitchFor(idea.id))}
                  canEdit={canEdit}
                  busy={busyIds.includes(idea.id)}
                  onSelect={(v) => setSelected((s) => (v ? [...s, idea.id] : s.filter((x) => x !== idea.id)))}
                  onAction={(a) => act(idea, a)}
                />
              ))}
            </div>
          ) : (
            <EmptyState title={filter === "all" ? "No concepts yet" : `No ${filter === "draft" ? "drafts" : filter} concepts`} body={filter === "shortlisted" ? "Star the concepts worth developing." : undefined} />
          )}
        </>
      ) : (
        <ExtrasPanel extras={set.extras} kind={tab} />
      )}

      {selected.length > 0 && tab === "concepts" && (
        <div className="fixed inset-x-0 bottom-5 z-30 flex justify-center px-4">
          <div className="flex flex-wrap items-center gap-2 rounded-full border border-line bg-surface px-3 py-2 shadow-[var(--shadow-lift)]">
            <span className="px-2 text-[13px] font-medium text-ink">{selected.length} selected</span>
            <Button size="sm" variant="secondary" disabled={selected.length < 2 || selected.length > 4} onClick={() => setCompareOpen(true)} title="Compare 2 to 4 concepts">
              <Columns3 className="h-3.5 w-3.5" /> Compare
            </Button>
            {canEdit && (
              <Button size="sm" variant="secondary" disabled={!bothShortlisted} onClick={() => setCombineIds([selected[0], selected[1]])} title={bothShortlisted ? "Combine into a new concept" : "Select exactly two shortlisted concepts"}>
                <GitMerge className="h-3.5 w-3.5" /> Combine
              </Button>
            )}
            <AddToOpportunity
              size="sm"
              label="Add to Opportunity"
              defaults={{ name: `${set.destination} partnership`, destination: set.destination, tourism_board: brief.tourism_board ?? null, summary: selIdeas.map((i) => i.content.name).join("; ") }}
              links={{
                idea_ids: selected,
                report_id: set.report_id,
                shortlisted_idea_id: selIdeas.find((i) => i.status === "shortlisted" || i.status === "approved")?.id ?? null,
              }}
            />
            <button onClick={() => setSelected([])} className="rounded-full p-1.5 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Clear selection">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <CompareDialog
        open={compareOpen}
        onOpenChange={setCompareOpen}
        ideas={selIdeas}
        canEdit={canEdit}
        onShortlist={(i) => patchStatus(i, i.status === "shortlisted" || i.status === "approved" ? "draft" : "shortlisted")}
        onCombine={(ids) => setCombineIds(ids)}
        onOpenIdea={(id) => {
          setCompareOpen(false);
          openIdea(id);
        }}
      />

      <Dialog
        open={Boolean(combineIds)}
        onOpenChange={(o) => !o && setCombineIds(null)}
        title="Combine two concepts"
        description="Creates a new concept. Both originals stay exactly as they are."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCombineIds(null)}>
              Cancel
            </Button>
            <Button onClick={() => combineIds && combine(combineIds)} loading={combining}>
              <GitMerge className="h-4 w-4" /> Combine
            </Button>
          </>
        }
      >
        <ul className="space-y-2">
          {combineIds?.map((id) => {
            const i = ideas.find((x) => x.id === id);
            return i ? (
              <li key={id} className="rounded-xl border border-line p-3">
                <p className="text-sm font-semibold">{i.content.name}</p>
                <p className="text-[13px] italic text-muted">{i.content.line}</p>
              </li>
            ) : null;
          })}
        </ul>
        <p className="mt-3 text-[13px] text-muted">The new concept explains what was retained, what was removed, how they were merged, why it&apos;s stronger and what it means for feasibility.</p>
      </Dialog>

      <Dialog
        open={Boolean(confirmRegen)}
        onOpenChange={(o) => !o && setConfirmRegen(null)}
        title="Regenerate this concept?"
        description={confirmRegen?.content.name}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmRegen(null)}>
              Cancel
            </Button>
            <Button onClick={() => confirmRegen && regenerate(confirmRegen)}>
              <RefreshCw className="h-4 w-4" /> Regenerate
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink/80">
          Unedited fields get a fresh take.{" "}
          {confirmRegen?.locked_fields.length ? `Your ${confirmRegen.locked_fields.length} hand-edited field(s) (${confirmRegen.locked_fields.join(", ").replace(/_/g, " ")}) stay exactly as they are.` : "No fields have been edited by hand yet."} The current version stays in history so you can restore it.
        </p>
      </Dialog>

      <Dialog
        open={regenOpen}
        onOpenChange={setRegenOpen}
        title={`Regenerate with research v${data.report?.version ?? ""}`}
        description="Choose which ideas to refresh. Others stay linked to the version they were built on."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRegenOpen(false)}>
              Cancel
            </Button>
            <Button onClick={regenerateWithLatest} loading={regenBusy} disabled={!regenPick.length}>
              Regenerate {regenPick.length || ""}
            </Button>
          </>
        }
      >
        <div className="max-h-80 space-y-1.5 overflow-y-auto">
          {staleIdeas.map((i) => (
            <label key={i.id} className="flex cursor-pointer items-start gap-2.5 rounded-lg p-2 hover:bg-ink/[0.03]">
              <input type="checkbox" className="mt-1 accent-[#4169D7]" checked={regenPick.includes(i.id)} onChange={(e) => setRegenPick((p) => (e.target.checked ? [...p, i.id] : p.filter((x) => x !== i.id)))} />
              <span>
                <span className="block text-sm font-medium">{i.content.name}</span>
                <span className="block text-[12px] text-muted">
                  Built on v{i.report_version}
                  {i.locked_fields.length ? ` · ${i.locked_fields.length} edited field(s) kept` : ""}
                </span>
              </span>
            </label>
          ))}
        </div>
        {regenBusy && (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-muted">
            <AlertCircle className="h-3.5 w-3.5" /> This can take a minute per idea.
          </p>
        )}
      </Dialog>
    </div>
  );
}
