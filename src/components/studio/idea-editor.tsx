"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Lock,
  Unlock,
  Sparkles,
  BookOpen,
  MessageSquare,
  History,
  BadgeCheck,
  Star,
  X,
  RotateCcw,
  Copy,
  RefreshCw,
  FileText,
  Wand2,
  ExternalLink,
  GitMerge,
  Loader2,
} from "lucide-react";
import type { CampaignIdea, CampaignComment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, Input, Label, Notice, Skeleton, Textarea } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/dialog";
import { CitationProvider, Cite } from "@/components/sources/citations";
import { ClaimStatusBadge, DemoBadge, KindLabel } from "@/components/sources/status-badge";
import { SaveButton } from "@/components/shared/save-button";
import { AddToOpportunity } from "@/components/shared/add-to-opportunity";
import { Photo } from "@/components/media/photo";
import { useSession } from "@/components/shell/user-context";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/client";
import { cn, fmtDateTime, timeAgo } from "@/lib/utils";
import { FIELD_ORDER, feasibilityLabel, feasibilityTone, type IdeaDetail } from "./types";

type Panel = "assist" | "research" | "comments" | "history" | "review";

const ACTIONS: { key: string; label: string; hint: string }[] = [
  { key: "bolder", label: "Make It Bolder", hint: "More original, still feasible" },
  { key: "realistic", label: "Make It More Realistic", hint: "Simpler to execute" },
  { key: "destination", label: "Make It More Destination-Specific", hint: "Sharper local detail" },
  { key: "scapia", label: "Make It More Scapia-Focused", hint: "Integrations and planning journey" },
  { key: "name", label: "Improve the Campaign Name", hint: "Name and line" },
  { key: "hero", label: "Strengthen the Hero Idea", hint: "Hero activation only" },
  { key: "conversion", label: "Improve the Conversion Journey", hint: "Awareness to trip planning" },
];

interface Preview {
  action: string;
  label: string;
  changes: { field: string; label: string; before: string; after: string; reason: string }[];
  skipped_locked: { field: string; label: string; after: string }[];
  note: string;
}

export function IdeaEditor({
  ideaId,
  setId,
  latestReportVersion,
  onBack,
  onChanged,
  onOpenIdea,
}: {
  ideaId: string;
  setId: string;
  latestReportVersion: number | null;
  onBack: () => void;
  onChanged: (idea: CampaignIdea) => void;
  onOpenIdea: (id: string) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const { can } = useSession();
  const canEdit = can("editor");
  const [d, setD] = useState<IdeaDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("assist");
  const [saving, setSaving] = useState<string | null>(null);
  const [pitchBusy, setPitchBusy] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenBusy, setRegenBusy] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setD(await api<IdeaDetail>(`/api/ideas/${ideaId}`));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [ideaId]);
  useEffect(() => {
    load();
  }, [load]);

  const setIdea = (idea: CampaignIdea) => {
    setD((x) => (x ? { ...x, idea } : x));
    onChanged(idea);
  };

  async function saveField(field: string, value: string) {
    if (!d) return;
    const current = String((d.idea.content as unknown as Record<string, unknown>)[field] ?? "");
    if (current === value) return;
    setSaving(field);
    try {
      const r = await api<{ idea: CampaignIdea }>(`/api/ideas/${ideaId}`, { method: "PATCH", json: { content: { [field]: value }, source: "manual", expected_version: d.idea.version } });
      setIdea(r.idea);
      await refreshMeta();
    } catch (e) {
      toast((e as Error).message, "error");
      if (e instanceof ApiError && e.status === 409) load();
    } finally {
      setSaving(null);
    }
  }

  async function refreshMeta() {
    try {
      const fresh = await api<IdeaDetail>(`/api/ideas/${ideaId}`);
      setD(fresh);
    } catch {}
  }

  async function patch(json: Record<string, unknown>, msg?: string) {
    try {
      const r = await api<{ idea: CampaignIdea }>(`/api/ideas/${ideaId}`, { method: "PATCH", json });
      setIdea(r.idea);
      await refreshMeta();
      if (msg) toast(msg);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function duplicate() {
    try {
      const r = await api<{ idea: CampaignIdea }>(`/api/ideas/${ideaId}/duplicate`, { method: "POST" });
      onChanged(r.idea);
      toast("Duplicated. Opening the copy.");
      onOpenIdea(r.idea.id);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function regenerate() {
    setRegenBusy(true);
    try {
      const r = await api<{ idea: CampaignIdea }>(`/api/ideas/${ideaId}/regenerate`, { method: "POST" });
      setIdea(r.idea);
      await refreshMeta();
      setRegenOpen(false);
      toast("Regenerated. Your edited fields were kept.");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setRegenBusy(false);
    }
  }

  async function developPitch() {
    if (!d) return;
    if (d.pitches[0]) return router.push(`/studio/${setId}/pitch/${d.pitches[0].id}`);
    setPitchBusy(true);
    try {
      const r = await api<{ pitch: { id: string } }>("/api/pitches", { json: { idea_id: ideaId } });
      router.push(`/studio/${setId}/pitch/${r.pitch.id}`);
    } catch (e) {
      toast((e as Error).message, "error");
      setPitchBusy(false);
    }
  }

  if (err) return <EmptyState title="We couldn't open this concept" body={err} action={<Button variant="secondary" onClick={onBack}>Back to all ideas</Button>} />;
  if (!d)
    return (
      <div className="grid gap-6 lg:grid-cols-[200px_1fr_340px]">
        <Skeleton className="h-96" />
        <Skeleton className="h-[600px]" />
        <Skeleton className="h-96" />
      </div>
    );

  const { idea } = d;
  const c = idea.content as unknown as Record<string, string>;
  const shortlisted = idea.status === "shortlisted" || idea.status === "approved";
  const locked = new Set(idea.locked_fields);
  const newer = latestReportVersion !== null && idea.report_version !== null && latestReportVersion > idea.report_version;

  return (
    <CitationProvider claims={d.research.claims} sources={d.research.sources}>
      <div className="-mt-2">
        <div className="mb-5 flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <button onClick={onBack} className="inline-flex items-center gap-1.5 self-start text-[13px] text-muted hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" /> All ideas · {d.set.title}
          </button>
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <>
                <Button size="sm" variant={shortlisted ? "outline" : "secondary"} onClick={() => patch({ status: shortlisted ? "draft" : "shortlisted" }, shortlisted ? "Removed from shortlist." : "Shortlisted. One for the story.")}>
                  <Star className={cn("h-3.5 w-3.5", shortlisted && "fill-current text-accent")} /> {shortlisted ? "Shortlisted" : "Shortlist"}
                </Button>
                {idea.status === "rejected" ? (
                  <Button size="sm" variant="secondary" onClick={() => patch({ status: "draft" }, "Restored to drafts.")}>
                    <RotateCcw className="h-3.5 w-3.5" /> Restore
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => patch({ status: "rejected" }, "Rejected.")}>
                    <X className="h-3.5 w-3.5" /> Reject
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={duplicate}>
                  <Copy className="h-3.5 w-3.5" /> Duplicate
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRegenOpen(true)}>
                  <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                </Button>
              </>
            )}
            <SaveButton type="idea" id={idea.id} label={idea.content.name} variant="button" className="h-8 px-3 text-[13px]" />
            <AddToOpportunity
              size="sm"
              label="Add to Opportunity"
              defaults={{ name: `${idea.destination}: ${idea.content.name}`, destination: idea.destination, tourism_board: d.set.brief.tourism_board ?? null, summary: idea.content.summary }}
              links={{ idea_ids: [idea.id], report_id: idea.report_id, shortlisted_idea_id: shortlisted ? idea.id : null, pitch_id: d.pitches[0]?.id ?? null }}
            />
            {(canEdit || d.pitches[0]) && (
              <Button size="sm" onClick={developPitch} loading={pitchBusy} disabled={idea.status === "rejected"}>
                <FileText className="h-3.5 w-3.5" /> {d.pitches[0] ? "Open pitch" : "Develop into Pitch"}
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[190px_minmax(0,1fr)] xl:grid-cols-[190px_minmax(0,1fr)_360px]">
          {/* Left: sections */}
          <nav className="hidden lg:block" aria-label="Campaign sections">
            <div className="sticky top-24 space-y-0.5">
              <p className="eyebrow mb-2">Sections</p>
              {[["name", "Name and line"], ...FIELD_ORDER].map(([k, label]) => (
                <a
                  key={k}
                  href={`#f-${k}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(`f-${k}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="flex items-center justify-between rounded-md px-2 py-1 text-[13px] text-ink/70 hover:bg-ink/[0.04] hover:text-ink"
                >
                  <span className="truncate">{label}</span>
                  {(locked.has(k) || (k === "name" && (locked.has("name") || locked.has("line")))) && <Lock className="h-3 w-3 shrink-0 text-accent" aria-label="Edited by the team" />}
                </a>
              ))}
              <div className="mt-4 space-y-1.5 border-t border-line pt-4 text-[12px] text-muted">
                <p>
                  Version <span className="font-medium text-ink">{idea.version}</span>
                </p>
                <p>Updated {timeAgo(idea.updated_at)}</p>
                <p className="flex items-center gap-1">
                  <Lock className="h-3 w-3 text-accent" /> {idea.locked_fields.length} protected field(s)
                </p>
              </div>
            </div>
          </nav>

          {/* Centre: editable document */}
          <div ref={docRef} className="min-w-0">
            <Card className="overflow-hidden">
              <Photo image={idea.image} label={idea.destination} className="h-48 md:h-56" />
              <div className="space-y-1 p-6 md:p-8">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <KindLabel kind="hypothesis" />
                  <Badge tone={feasibilityTone(idea.content.feasibility)}>{feasibilityLabel(idea.content.feasibility)}</Badge>
                  {idea.status === "approved" && (
                    <Badge tone="mint">
                      <BadgeCheck className="h-3 w-3" /> Approved
                    </Badge>
                  )}
                  {idea.status === "rejected" && <Badge tone="danger">Rejected</Badge>}
                  {idea.is_demo && <DemoBadge />}
                  {saving && (
                    <span className="inline-flex items-center gap-1 text-[12px] text-muted">
                      <Loader2 className="h-3 w-3 animate-spin" /> Saving…
                    </span>
                  )}
                </div>
                {newer && (
                  <div className="mb-4">
                    <Notice tone="blue" title={`Built on research v${idea.report_version}; v${latestReportVersion} is available`}>
                      Use Regenerate on the studio page to refresh selected ideas. Nothing changes automatically.
                    </Notice>
                  </div>
                )}
                {idea.merge_notes && (
                  <div className="mb-4 rounded-xl border border-peach-ink/15 bg-soft-peach/60 p-4 text-[13px] text-ink/85">
                    <p className="mb-1.5 flex items-center gap-1.5 font-medium text-peach-ink">
                      <GitMerge className="h-3.5 w-3.5" /> How this concept was combined
                    </p>
                    <p className="whitespace-pre-line">{idea.merge_notes}</p>
                    {d.parents.length > 0 && (
                      <p className="mt-2 text-[12px]">
                        Originals:{" "}
                        {d.parents.map((p, i) => (
                          <span key={p.id}>
                            {i > 0 && " · "}
                            <button className="text-accent hover:underline" onClick={() => onOpenIdea(p.id)}>
                              {p.name}
                            </button>
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                )}
                <div id="f-name" className="scroll-mt-24">
                  <FieldInput label="Campaign name" field="name" value={c.name} locked={locked.has("name")} disabled={!canEdit} onSave={saveField} large />
                  <FieldInput label="Campaign line" field="line" value={c.line} locked={locked.has("line")} disabled={!canEdit} onSave={saveField} italic />
                </div>
                {FIELD_ORDER.map(([k, label, hint]) => (
                  <div key={k} id={`f-${k}`} className="scroll-mt-24">
                    <FieldArea
                      label={label}
                      hint={hint}
                      field={k}
                      value={c[k] ?? ""}
                      locked={locked.has(k)}
                      disabled={!canEdit}
                      onSave={saveField}
                      cite={k === "research_notes" || k === "core_insight" ? idea.content.research_claim_ids : undefined}
                    />
                  </div>
                ))}
                <div className="pt-4">
                  <p className="mb-2 text-[13px] font-medium text-ink">Dependencies</p>
                  <DependencyFlags flags={idea.content.dependency_flags} disabled={!canEdit} onChange={(flags) => patch({ dependency_flags: flags, source: "manual", action: "Edited dependency flags" })} />
                </div>
              </div>
            </Card>
          </div>

          {/* Right: assistant, research, comments, history, review */}
          <aside className="min-w-0 lg:col-span-2 xl:col-span-1">
            <div className="sticky top-24">
              <Card className="overflow-hidden">
                <div className="grid grid-cols-5 border-b border-line" role="tablist">
                  {(
                    [
                      ["assist", Sparkles, "Assist"],
                      ["research", BookOpen, "Research"],
                      ["comments", MessageSquare, "Notes"],
                      ["history", History, "History"],
                      ["review", BadgeCheck, "Review"],
                    ] as const
                  ).map(([k, Icon, label]) => (
                    <button
                      key={k}
                      role="tab"
                      aria-selected={panel === k}
                      onClick={() => setPanel(k)}
                      className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors", panel === k ? "bg-soft-blue/60 font-medium text-accent" : "text-muted hover:text-ink")}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
                <div className="max-h-[calc(100vh-190px)] overflow-y-auto p-4 scrollbar-thin">
                  {panel === "assist" && <AssistPanel detail={d} canEdit={canEdit} onApplied={async (idea) => { setIdea(idea); await refreshMeta(); }} />}
                  {panel === "research" && <ResearchPanel detail={d} />}
                  {panel === "comments" && <CommentsPanel ideaId={idea.id} comments={d.comments} canEdit={canEdit} onAdded={(cm) => setD((x) => (x ? { ...x, comments: [...x.comments, cm] } : x))} />}
                  {panel === "history" && <HistoryPanel detail={d} canEdit={canEdit} onRestored={async (idea) => { setIdea(idea); await refreshMeta(); toast("Restored. This is now the latest version."); }} />}
                  {panel === "review" && <ReviewPanel idea={idea} canEdit={canEdit} onPatch={patch} />}
                </div>
              </Card>
            </div>
          </aside>
        </div>
      </div>

      <Dialog
        open={regenOpen}
        onOpenChange={setRegenOpen}
        title="Regenerate this concept?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRegenOpen(false)}>
              Cancel
            </Button>
            <Button onClick={regenerate} loading={regenBusy}>
              <RefreshCw className="h-4 w-4" /> Regenerate
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink/80">
          Unedited fields get a fresh take. {idea.locked_fields.length ? `Your ${idea.locked_fields.length} hand-edited field(s) stay exactly as they are.` : ""} Version {idea.version} stays in history.
        </p>
      </Dialog>
    </CitationProvider>
  );
}

/* ---------------------------------------------------------------- fields */

function LockBadge({ locked }: { locked: boolean }) {
  if (!locked) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-soft-blue px-2 py-0.5 text-[11px] font-medium text-accent" title="Edited by the team. AI won't change this unless you allow it.">
      <Lock className="h-3 w-3" /> Your edit
    </span>
  );
}

function FieldInput({ label, field, value, locked, disabled, onSave, large, italic }: { label: string; field: string; value: string; locked: boolean; disabled: boolean; onSave: (f: string, v: string) => void; large?: boolean; italic?: boolean }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <div className="group pb-2">
      <div className="flex items-center gap-2">
        <label htmlFor={`in-${field}`} className="sr-only">
          {label}
        </label>
        <LockBadge locked={locked} />
      </div>
      <input
        id={`in-${field}`}
        value={v}
        disabled={disabled}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v.trim() && onSave(field, v.trim())}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className={cn(
          "w-full rounded-lg border border-transparent bg-transparent px-1 -mx-1 text-ink transition-colors hover:border-line focus:border-accent focus:bg-surface focus:outline-none disabled:hover:border-transparent",
          large ? "text-[28px] font-semibold leading-tight tracking-[-0.02em] md:text-[32px]" : "text-[17px]",
          italic && "italic text-ink/75",
        )}
      />
    </div>
  );
}

function FieldArea({ label, hint, field, value, locked, disabled, onSave, cite }: { label: string; hint?: string; field: string; value: string; locked: boolean; disabled: boolean; onSave: (f: string, v: string) => void; cite?: string[] }) {
  const [v, setV] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setV(value), [value]);
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight + 2}px`;
    }
  }, [v]);
  return (
    <div className="border-t border-line pt-4 pb-2">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <label htmlFor={`ta-${field}`} className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
          {label}
        </label>
        {cite && cite.length > 0 && <Cite ids={cite} />}
        <LockBadge locked={locked} />
        {hint && <span className="text-[11px] text-muted">{hint}</span>}
      </div>
      <textarea
        id={`ta-${field}`}
        ref={ref}
        value={v}
        disabled={disabled}
        rows={2}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => onSave(field, v)}
        className="w-full resize-none overflow-hidden rounded-lg border border-transparent bg-transparent px-2 py-1.5 -mx-2 text-[14.5px] leading-relaxed text-ink transition-colors hover:border-line focus:border-accent focus:bg-surface focus:outline-none disabled:hover:border-transparent"
      />
    </div>
  );
}

function DependencyFlags({ flags, disabled, onChange }: { flags: string[]; disabled: boolean; onChange: (f: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const SUGGEST = ["Requires product development", "Requires external partner", "Requires new integration", "Requires tourism-board approval", "Requires permits"];
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {flags.length === 0 && <span className="text-[13px] text-muted">None flagged.</span>}
        {flags.map((f) => (
          <span key={f} className="inline-flex items-center gap-1 rounded-full bg-soft-peach px-2.5 py-0.5 text-[12px] text-peach-ink">
            {f}
            {!disabled && (
              <button onClick={() => onChange(flags.filter((x) => x !== f))} aria-label={`Remove ${f}`} className="hover:text-danger">
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      {!disabled && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SUGGEST.filter((s) => !flags.includes(s)).map((s) => (
            <button key={s} onClick={() => onChange([...flags, s])} className="rounded-full border border-dashed border-line px-2.5 py-0.5 text-[12px] text-muted hover:border-ink/30 hover:text-ink">
              + {s}
            </button>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) onChange([...flags, draft.trim()]);
              setDraft("");
            }}
          >
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Other dependency…" className="h-6 rounded-full border border-line px-2.5 text-[12px] focus:border-accent focus:outline-none" aria-label="Add dependency" />
          </form>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- right panels */

function AssistPanel({ detail, canEdit, onApplied }: { detail: IdeaDetail; canEdit: boolean; onApplied: (idea: CampaignIdea) => Promise<void> }) {
  const toast = useToast();
  const [allow, setAllow] = useState(false);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [baseVersion, setBaseVersion] = useState<number>(detail.idea.version);
  const [accept, setAccept] = useState<Record<string, boolean>>({});
  const [applying, setApplying] = useState(false);

  async function run(action: string) {
    setBusy(action);
    setPreview(null);
    try {
      const r = await api<{ preview: Preview; base_version: number }>(`/api/ideas/${detail.idea.id}/refine`, { json: { action, instruction: custom, allow_overwrite: allow } });
      setPreview(r.preview);
      setBaseVersion(r.base_version);
      setAccept(Object.fromEntries(r.preview.changes.map((c) => [c.field, true])));
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function apply() {
    if (!preview) return;
    const chosen = preview.changes.filter((c) => accept[c.field]);
    if (!chosen.length) return setPreview(null);
    setApplying(true);
    try {
      const r = await api<{ idea: CampaignIdea }>(`/api/ideas/${detail.idea.id}`, {
        method: "PATCH",
        json: { content: Object.fromEntries(chosen.map((c) => [c.field, c.after])), source: "ai", action: `AI: ${preview.label}`, expected_version: baseVersion },
      });
      await onApplied(r.idea);
      setPreview(null);
      setCustom("");
      toast(`Applied ${chosen.length} change(s). Everything else is untouched.`);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setApplying(false);
    }
  }

  if (!canEdit) return <p className="text-sm text-muted">Viewers can read concepts but not refine them.</p>;

  if (preview)
    return (
      <div className="space-y-4">
        <div>
          <p className="text-[14px] font-semibold text-ink">{preview.label}: preview</p>
          {preview.note && <p className="mt-1 text-[12px] text-muted">{preview.note}</p>}
        </div>
        {preview.changes.length === 0 && <p className="text-sm text-muted">No changes proposed for the allowed fields.</p>}
        {preview.changes.map((ch) => (
          <div key={ch.field} className="rounded-xl border border-line p-3">
            <label className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
              <input type="checkbox" className="accent-[#4169D7]" checked={accept[ch.field] ?? false} onChange={(e) => setAccept((a) => ({ ...a, [ch.field]: e.target.checked }))} />
              {ch.label}
            </label>
            <p className="whitespace-pre-line rounded-lg bg-soft-danger/60 px-2.5 py-1.5 text-[12.5px] text-ink/60 line-through decoration-danger/40">{ch.before || "(empty)"}</p>
            <p className="mt-1.5 whitespace-pre-line rounded-lg bg-soft-mint px-2.5 py-1.5 text-[12.5px] text-ink">{ch.after}</p>
            {ch.reason && <p className="mt-1.5 text-[11px] text-muted">{ch.reason}</p>}
          </div>
        ))}
        {preview.skipped_locked.length > 0 && (
          <div className="rounded-xl bg-soft-blue/60 p-3 text-[12.5px] text-ink/80">
            <p className="flex items-center gap-1.5 font-medium text-accent">
              <Lock className="h-3.5 w-3.5" /> Kept your edits
            </p>
            <p className="mt-1">
              {preview.skipped_locked.map((s) => s.label).join(", ")} {preview.skipped_locked.length === 1 ? "was" : "were"} edited by the team, so {preview.skipped_locked.length === 1 ? "it was" : "they were"} left alone. Tick “Allow overwriting my edits” and run again to include {preview.skipped_locked.length === 1 ? "it" : "them"}.
            </p>
          </div>
        )}
        <div className="flex gap-2">
          <Button size="sm" onClick={apply} loading={applying} disabled={!Object.values(accept).some(Boolean)}>
            Apply selected
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setPreview(null)}>
            Discard
          </Button>
        </div>
      </div>
    );

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[14px] font-semibold text-ink">Refine with AI</p>
        <p className="mt-0.5 text-[12px] text-muted">Each action only touches its own sections. You&apos;ll see a preview before anything changes.</p>
      </div>
      <div className="space-y-1.5">
        {ACTIONS.map((a) => (
          <button
            key={a.key}
            onClick={() => run(a.key)}
            disabled={Boolean(busy)}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5 text-left transition-colors hover:border-accent/40 hover:bg-soft-blue/40 disabled:opacity-50"
          >
            <span>
              <span className="block text-[13px] font-medium text-ink">{a.label}</span>
              <span className="block text-[11.5px] text-muted">{a.hint}</span>
            </span>
            {busy === a.key ? <Loader2 className="h-4 w-4 animate-spin text-accent" /> : <Wand2 className="h-4 w-4 text-muted" />}
          </button>
        ))}
      </div>
      <div>
        <Label htmlFor="custom-refine">Custom refinement</Label>
        <Textarea id="custom-refine" rows={3} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. Keep the concept, but give it a stronger Instagram creator series and reduce production complexity." />
        <Button size="sm" className="mt-2" onClick={() => run("custom")} loading={busy === "custom"} disabled={custom.trim().length < 5 || Boolean(busy)}>
          Refine
        </Button>
      </div>
      <label className="flex items-start gap-2 rounded-xl bg-ivory p-3 text-[12.5px] text-ink/80">
        <input type="checkbox" className="mt-0.5 accent-[#4169D7]" checked={allow} onChange={(e) => setAllow(e.target.checked)} />
        <span>
          Allow overwriting my edits
          <span className="block text-[11.5px] text-muted">
            Off by default. {detail.idea.locked_fields.length} field(s) are protected: {detail.idea.locked_fields.join(", ").replace(/_/g, " ") || "none"}.
          </span>
        </span>
      </label>
    </div>
  );
}

function ResearchPanel({ detail }: { detail: IdeaDetail }) {
  const { claims, sources } = detail.research;
  const { idea } = detail;
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[14px] font-semibold text-ink">Research behind this idea</p>
        {detail.report ? (
          <Link href={`/research/${detail.report.id}?version=${idea.report_version ?? detail.report.version}`} className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline">
            {detail.report.destination_name} report v{idea.report_version ?? detail.report.version} <ExternalLink className="h-3 w-3" />
          </Link>
        ) : (
          <p className="mt-1 text-[12px] text-muted">{detail.set.input_mode === "upload" ? `Built on an uploaded document (${detail.set.supplied_filename ?? "document"}). Not verified by plot twist.` : "Built on pasted research. Not verified by plot twist."}</p>
        )}
      </div>
      {idea.content.research_notes && (
        <div className="rounded-xl bg-ivory p-3 text-[12.5px] text-ink/80">
          <KindLabel kind="interpretation" />
          <p className="mt-1.5 whitespace-pre-line">{idea.content.research_notes}</p>
        </div>
      )}
      {claims.length ? (
        <ul className="space-y-2.5">
          {claims.map((cl) => (
            <li key={cl.id} className="rounded-xl border border-line p-3">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <ClaimStatusBadge status={cl.status} />
                <span className="text-[11px] text-muted">{cl.section}</span>
              </div>
              <p className="text-[13px] leading-snug text-ink">
                {cl.text}
                <Cite ids={[cl.id]} />
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <Notice tone="peach">No verified research findings are linked to this idea. Treat its insight as a hypothesis until it&apos;s checked.</Notice>
      )}
      {sources.length > 0 && <p className="text-[11.5px] text-muted">{sources.length} source(s). Click a number to open the evidence drawer.</p>}
    </div>
  );
}

function CommentsPanel({ ideaId, comments, canEdit, onAdded }: { ideaId: string; comments: CampaignComment[]; canEdit: boolean; onAdded: (c: CampaignComment) => void }) {
  const toast = useToast();
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"comment" | "note">("comment");
  const [busy, setBusy] = useState(false);
  async function add() {
    setBusy(true);
    try {
      const r = await api<{ comment: CampaignComment }>(`/api/ideas/${ideaId}/comments`, { json: { body, kind } });
      onAdded(r.comment);
      setBody("");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <p className="text-[14px] font-semibold text-ink">Comments and internal notes</p>
      {comments.length === 0 && <p className="text-[13px] text-muted">No comments yet.</p>}
      <ul className="space-y-3">
        {comments.map((c) => (
          <li key={c.id} className={cn("rounded-xl p-3 text-[13px]", c.kind === "note" ? "bg-soft-peach/60" : "bg-ivory")}>
            <p className="mb-1 flex items-center justify-between text-[11.5px] text-muted">
              <span className="font-medium text-ink">
                {c.author}
                {c.kind === "note" && <span className="ml-1.5 font-normal text-peach-ink">internal note</span>}
              </span>
              {timeAgo(c.created_at)}
            </p>
            <p className="whitespace-pre-line text-ink/90">{c.body}</p>
          </li>
        ))}
      </ul>
      {canEdit && (
        <div className="space-y-2">
          <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder={kind === "note" ? "Add an internal note…" : "Add a comment…"} aria-label="New comment" />
          <div className="flex items-center justify-between">
            <div className="inline-flex rounded-full border border-line p-0.5 text-[12px]">
              {(["comment", "note"] as const).map((k) => (
                <button key={k} onClick={() => setKind(k)} className={cn("rounded-full px-2.5 py-1 capitalize", kind === k ? "bg-ink text-white" : "text-ink/70")}>
                  {k}
                </button>
              ))}
            </div>
            <Button size="sm" onClick={add} loading={busy} disabled={!body.trim()}>
              Post
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryPanel({ detail, canEdit, onRestored }: { detail: IdeaDetail; canEdit: boolean; onRestored: (idea: CampaignIdea) => Promise<void> }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useState<string | null>(null);
  async function restore(id: string) {
    setBusy(id);
    try {
      const r = await api<{ idea: CampaignIdea }>(`/api/ideas/${detail.idea.id}/restore`, { json: { revision_id: id } });
      await onRestored(r.idea);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }
  const revs = [...detail.revisions].sort((a, b) => b.version - a.version);
  return (
    <div className="space-y-3">
      <p className="text-[14px] font-semibold text-ink">Version history</p>
      <ol className="relative space-y-3 border-l border-line pl-4">
        {revs.map((r) => (
          <li key={r.id} className="relative">
            <span className={cn("absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface", r.version === detail.idea.version ? "bg-accent" : "bg-ink/25")} />
            <p className="text-[13px] font-medium text-ink">
              v{r.version} · {r.action}
            </p>
            <p className="text-[11.5px] text-muted">
              {r.author} · {fmtDateTime(r.created_at)}
            </p>
            <div className="mt-1 flex gap-2">
              <button onClick={() => setView(view === r.id ? null : r.id)} className="text-[12px] text-accent hover:underline">
                {view === r.id ? "Hide" : "View"}
              </button>
              {canEdit && r.version !== detail.idea.version && (
                <button onClick={() => restore(r.id)} disabled={Boolean(busy)} className="text-[12px] text-accent hover:underline disabled:opacity-50">
                  {busy === r.id ? "Restoring…" : "Restore"}
                </button>
              )}
              {r.version === detail.idea.version && <span className="text-[12px] text-muted">Current</span>}
            </div>
            {view === r.id && (
              <div className="mt-2 space-y-1 rounded-lg bg-ivory p-2.5 text-[12px] text-ink/80">
                <p className="font-medium">{r.content.name}</p>
                <p className="italic">{r.content.line}</p>
                <p className="line-clamp-4">{r.content.hero_activation}</p>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function ReviewPanel({ idea, canEdit, onPatch }: { idea: CampaignIdea; canEdit: boolean; onPatch: (json: Record<string, unknown>, msg?: string) => Promise<void> }) {
  const [reviewer, setReviewer] = useState(idea.reviewer ?? "");
  const [note, setNote] = useState(idea.approval_note ?? "");
  useEffect(() => {
    setReviewer(idea.reviewer ?? "");
    setNote(idea.approval_note ?? "");
  }, [idea.reviewer, idea.approval_note]);
  return (
    <div className="space-y-4">
      <p className="text-[14px] font-semibold text-ink">Review and approval</p>
      <p className="text-[12px] text-muted">Approval records a human decision. The studio never marks a concept approved on its own.</p>
      <div>
        <Label htmlFor="reviewer">Reviewer</Label>
        <div className="flex gap-2">
          <Input id="reviewer" value={reviewer} disabled={!canEdit} onChange={(e) => setReviewer(e.target.value)} placeholder="Name of reviewer" />
          <Button size="sm" variant="secondary" disabled={!canEdit || reviewer === (idea.reviewer ?? "")} onClick={() => onPatch({ reviewer: reviewer || null }, reviewer ? `Assigned to ${reviewer}.` : "Reviewer cleared.")}>
            Assign
          </Button>
        </div>
      </div>
      <div>
        <Label htmlFor="approval">Final approval note</Label>
        <Textarea id="approval" rows={4} value={note} disabled={!canEdit} onChange={(e) => setNote(e.target.value)} placeholder="What was approved, by whom, and any conditions" />
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={!canEdit || note === (idea.approval_note ?? "")} onClick={() => onPatch({ approval_note: note || null }, "Note saved.")}>
            Save note
          </Button>
          {idea.status === "approved" ? (
            <Button size="sm" variant="outline" disabled={!canEdit} onClick={() => onPatch({ status: "shortlisted" }, "Approval withdrawn.")}>
              Withdraw approval
            </Button>
          ) : (
            <Button size="sm" disabled={!canEdit || !note.trim()} onClick={() => onPatch({ status: "approved", approval_note: note }, "Approved.")}>
              <BadgeCheck className="h-3.5 w-3.5" /> Approve
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
