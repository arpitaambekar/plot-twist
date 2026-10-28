"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/primitives";
import type { ReferenceCampaign } from "@/lib/types";
import { cn } from "@/lib/utils";

export const CAMPAIGN_TYPES = ["Interactive", "Gamified", "Creator-led", "PR", "Social-first", "Digital", "Film", "Cultural", "Seasonal", "Regional dispersal", "Conversion-led"] as const;

type Draft = {
  name: string;
  tourism_board: string;
  destination: string;
  launch_date: string;
  objective: string;
  insight: string;
  creative_idea: string;
  execution: string;
  participation_mechanism: string;
  channels: string;
  target_audience: string;
  campaign_types: string[];
  official_link: string;
  sources: { title: string; url: string; publisher: string; published: string }[];
  published_results: string;
  strategic_learning: string;
  scapia_relevance: string;
};

function toDraft(r?: ReferenceCampaign): Draft {
  return {
    name: r?.name ?? "",
    tourism_board: r?.tourism_board ?? "",
    destination: r?.destination ?? "",
    launch_date: r?.launch_date ?? "",
    objective: r?.objective ?? "",
    insight: r?.insight ?? "",
    creative_idea: r?.creative_idea ?? "",
    execution: r?.execution ?? "",
    participation_mechanism: r?.participation_mechanism ?? "",
    channels: r?.channels.join(", ") ?? "",
    target_audience: r?.target_audience ?? "",
    campaign_types: r?.campaign_types ?? [],
    official_link: r?.official_link ?? "",
    sources: r?.sources.map((s) => ({ ...s, published: s.published ?? "" })) ?? [{ title: "", url: "", publisher: "", published: "" }],
    published_results: r?.published_results ?? "",
    strategic_learning: r?.strategic_learning ?? "",
    scapia_relevance: r?.scapia_relevance ?? "",
  };
}

/** Add / edit form. At least one source URL is mandatory: the library never holds unsourced campaigns. */
export function ReferenceForm({ initial, onSubmit, busy, submitLabel }: { initial?: ReferenceCampaign; onSubmit: (payload: Record<string, unknown>) => void; busy: boolean; submitLabel: string }) {
  const [d, setD] = useState<Draft>(() => toDraft(initial));
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const validSources = d.sources.filter((s) => /^https?:\/\/\S+\.\S+/.test(s.url.trim()));
  const canSubmit = d.name.trim().length > 1 && d.tourism_board.trim().length > 1 && d.destination.trim().length > 1 && validSources.length > 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      ...d,
      launch_date: d.launch_date || null,
      official_link: d.official_link.trim() || null,
      published_results: d.published_results.trim() || null,
      channels: d.channels
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
      sources: validSources.map((s) => ({ title: s.title.trim() || s.url.trim(), url: s.url.trim(), publisher: s.publisher.trim(), published: s.published.trim() || null })),
    });
  }

  const area = (k: keyof Draft, label: string, rows = 2, hint?: string) => (
    <div>
      <Label htmlFor={`rf-${k}`} hint={hint}>
        {label}
      </Label>
      <Textarea id={`rf-${k}`} rows={rows} value={d[k] as string} onChange={(e) => set(k, e.target.value as never)} />
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="rf-name">Campaign name</Label>
          <Input id="rf-name" required value={d.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="rf-board">Tourism board</Label>
          <Input id="rf-board" required value={d.tourism_board} onChange={(e) => set("tourism_board", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="rf-dest">Destination (country)</Label>
          <Input id="rf-dest" required value={d.destination} onChange={(e) => set("destination", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="rf-date" hint="YYYY or YYYY-MM">
            Launch date
          </Label>
          <Input id="rf-date" value={d.launch_date} pattern="\d{4}(-\d{2})?" onChange={(e) => set("launch_date", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="rf-link">Official campaign link</Label>
          <Input id="rf-link" type="url" value={d.official_link} onChange={(e) => set("official_link", e.target.value)} />
        </div>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-[13px] font-medium text-ink">Campaign type</legend>
        <div className="flex flex-wrap gap-1.5">
          {CAMPAIGN_TYPES.map((t) => {
            const on = d.campaign_types.includes(t);
            return (
              <button
                type="button"
                key={t}
                aria-pressed={on}
                onClick={() => set("campaign_types", on ? d.campaign_types.filter((x) => x !== t) : [...d.campaign_types, t])}
                className={cn("rounded-full border px-3 py-1 text-[13px]", on ? "border-accent bg-soft-blue text-accent" : "border-line text-ink/75 hover:border-ink/25")}
              >
                {t}
              </button>
            );
          })}
        </div>
      </fieldset>

      {area("objective", "Objective")}
      {area("insight", "Insight")}
      {area("creative_idea", "Main creative idea")}
      {area("execution", "Execution", 3)}
      {area("participation_mechanism", "Participation mechanism")}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="rf-ch" hint="comma-separated">
            Channels
          </Label>
          <Input id="rf-ch" value={d.channels} onChange={(e) => set("channels", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="rf-aud">Target audience</Label>
          <Input id="rf-aud" value={d.target_audience} onChange={(e) => set("target_audience", e.target.value)} />
        </div>
      </div>
      {area("published_results", "Published results", 2, "only figures stated by a source, with who reported them")}
      {area("strategic_learning", "Strategic learning", 2, "your interpretation")}
      {area("scapia_relevance", "Relevance to Scapia", 2, "your interpretation")}

      <fieldset className="space-y-2">
        <legend className="mb-1 text-[13px] font-medium text-ink">
          Supporting sources <span className="font-normal text-muted">(at least one URL required)</span>
        </legend>
        {d.sources.map((s, i) => (
          <div key={i} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1fr_1fr_auto]">
            <Input aria-label={`Source ${i + 1} URL`} type="url" placeholder="https://…" value={s.url} onChange={(e) => set("sources", d.sources.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
            <Input aria-label={`Source ${i + 1} title`} placeholder="Title" value={s.title} onChange={(e) => set("sources", d.sources.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
            <button
              type="button"
              onClick={() => set("sources", d.sources.filter((_, j) => j !== i))}
              disabled={d.sources.length === 1}
              className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-ink/5 hover:text-danger disabled:opacity-30"
              aria-label={`Remove source ${i + 1}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <Input aria-label={`Source ${i + 1} publisher`} placeholder="Publisher" value={s.publisher} onChange={(e) => set("sources", d.sources.map((x, j) => (j === i ? { ...x, publisher: e.target.value } : x)))} />
            <Input aria-label={`Source ${i + 1} published date`} placeholder="Published (YYYY-MM-DD)" value={s.published} onChange={(e) => set("sources", d.sources.map((x, j) => (j === i ? { ...x, published: e.target.value } : x)))} />
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" onClick={() => set("sources", [...d.sources, { title: "", url: "", publisher: "", published: "" }])}>
          <Plus className="h-4 w-4" /> Add source
        </Button>
      </fieldset>

      <div className="flex items-center justify-end gap-3 border-t border-line pt-4">
        {!canSubmit && <p className="text-[12px] text-muted">Name, board, destination and one valid source URL are required.</p>}
        <Button type="submit" loading={busy} disabled={!canSubmit}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
