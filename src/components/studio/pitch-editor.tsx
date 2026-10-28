"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Loader2, ExternalLink } from "lucide-react";
import type { CampaignIdea, Pitch, SourceRecord } from "@/lib/types";
import { PITCH_SECTIONS } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/primitives";
import { DemoBadge, KindLabel } from "@/components/sources/status-badge";
import { AddToOpportunity } from "@/components/shared/add-to-opportunity";
import { SaveButton } from "@/components/shared/save-button";
import { Photo } from "@/components/media/photo";
import { useSession } from "@/components/shell/user-context";
import { useToast } from "@/components/ui/toast";
import { api, download, ApiError } from "@/lib/client";
import { cn, timeAgo } from "@/lib/utils";

export function PitchEditor({ initialPitch, idea, setId, boardHint, sources }: { initialPitch: Pitch; idea: CampaignIdea; setId: string; boardHint: string | null; sources: SourceRecord[] }) {
  const toast = useToast();
  const { can } = useSession();
  const canEdit = can("editor");
  const [pitch, setPitch] = useState(initialPitch);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [active, setActive] = useState<string>(PITCH_SECTIONS[0][0]);

  async function save(patch: { title?: string; sections?: Record<string, string> }) {
    setSaving(true);
    try {
      const r = await api<{ pitch: Pitch }>(`/api/pitches/${pitch.id}`, { method: "PATCH", json: { ...patch, expected_version: pitch.version } });
      setPitch(r.pitch);
    } catch (e) {
      toast((e as Error).message, "error");
      if (e instanceof ApiError && e.status === 409) window.location.reload();
    } finally {
      setSaving(false);
    }
  }

  async function exportDocx() {
    setExporting(true);
    try {
      await download(`/api/pitches/${pitch.id}/docx`);
      toast("Word pitch downloaded.");
    } catch (e) {
      toast(`Export failed: ${(e as Error).message}`, "error");
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActive(vis.target.id.replace("p-", ""));
      },
      { rootMargin: "-100px 0px -60% 0px" },
    );
    PITCH_SECTIONS.forEach(([k]) => {
      const el = document.getElementById(`p-${k}`);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return (
    <div>
      <Link href={`/studio/${setId}?idea=${idea.id}`} className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to concept
      </Link>
      <div className="mb-6 flex flex-col gap-4">
        <div className="min-w-0">
          <p className="eyebrow mb-2">Partnership pitch · {pitch.destination}</p>
          <TitleInput value={pitch.title} disabled={!canEdit} onSave={(t) => save({ title: t })} />
          <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-muted">
            Version {pitch.version} · Updated {timeAgo(pitch.updated_at)}
            {saving && (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving…
              </span>
            )}
            {pitch.is_demo && <DemoBadge />}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SaveButton type="pitch" id={pitch.id} label={pitch.title} variant="button" />
          <AddToOpportunity
            defaults={{ name: `${pitch.destination}: ${idea.content.name}`, destination: pitch.destination, tourism_board: boardHint, summary: idea.content.summary }}
            links={{ idea_ids: [idea.id], shortlisted_idea_id: idea.id, pitch_id: pitch.id, report_id: idea.report_id }}
          />
          <Button onClick={exportDocx} loading={exporting}>
            <Download className="h-4 w-4" /> Download Word Pitch
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <Notice tone="blue">
          Facts come from the linked research; everything else is strategic interpretation or creative hypothesis for discussion. Edit freely: changes save when you click away.
        </Notice>
      </div>

      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="hidden lg:block" aria-label="Pitch sections">
          <ol className="sticky top-24 space-y-0.5">
            {PITCH_SECTIONS.map(([k, label], i) => (
              <li key={k}>
                <a
                  href={`#p-${k}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(`p-${k}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={cn("block rounded-md px-2 py-1 text-[13px] transition-colors", active === k ? "bg-soft-blue font-medium text-accent" : "text-ink/70 hover:text-ink")}
                >
                  <span className="mr-1.5 tabular-nums text-muted">{String(i + 1).padStart(2, "0")}</span>
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <Card className="overflow-hidden">
          <Photo image={idea.image} label={idea.destination} className="h-44" />
          <div className="p-6 md:p-10">
            <p className="text-[13px] text-muted">Concept</p>
            <p className="text-[22px] font-semibold tracking-[-0.01em] text-ink">{idea.content.name}</p>
            <p className="italic text-ink/70">{idea.content.line}</p>
            {PITCH_SECTIONS.map(([k, label], i) => (
              <section key={k} id={`p-${k}`} className="scroll-mt-24 border-t border-line pt-6 mt-6">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-ink">
                    <span className="mr-2 text-muted tabular-nums">{i + 1}.</span>
                    {label}
                  </h2>
                  {k === "supporting_research" ? <KindLabel kind="fact" /> : ["destination_opportunity", "traveller_insight"].includes(k) ? <KindLabel kind="interpretation" /> : null}
                </div>
                <SectionArea value={pitch.sections[k] ?? ""} disabled={!canEdit} onSave={(v) => v !== pitch.sections[k] && save({ sections: { [k]: v } })} />
                {k === "supporting_research" && sources.length > 0 && (
                  <ul className="mt-3 space-y-1 text-[12.5px]">
                    {sources.map((s, n) => (
                      <li key={s.id}>
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                          [{n + 1}] {s.title} <ExternalLink className="h-3 w-3" />
                        </a>
                        <span className="text-muted"> · {s.publisher}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function TitleInput({ value, disabled, onSave }: { value: string; disabled: boolean; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      value={v}
      disabled={disabled}
      aria-label="Pitch title"
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v.trim().length > 1 && v !== value && onSave(v.trim())}
      className="-mx-1 w-full rounded-lg border border-transparent bg-transparent px-1 text-[30px] font-semibold leading-tight tracking-[-0.02em] text-ink hover:border-line focus:border-accent focus:outline-none md:text-[34px]"
    />
  );
}

function SectionArea({ value, disabled, onSave }: { value: string; disabled: boolean; onSave: (v: string) => void }) {
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
    <textarea
      ref={ref}
      value={v}
      disabled={disabled}
      rows={3}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => onSave(v)}
      className="-mx-2 w-full resize-none overflow-hidden rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[14.5px] leading-relaxed text-ink hover:border-line focus:border-accent focus:bg-surface focus:outline-none"
    />
  );
}
