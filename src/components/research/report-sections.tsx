"use client";
import type { ReactNode } from "react";
import { ExternalLink, MapPin, ChevronDown } from "lucide-react";
import type { Claim, PlaceItem, SourceRecord, SourcedText } from "@/lib/types";
import { Cite } from "@/components/sources/citations";
import { KindLabel } from "@/components/sources/status-badge";
import { Photo } from "@/components/media/photo";
import { Badge } from "@/components/ui/primitives";
import { fmtDate, cn } from "@/lib/utils";

export function Section({ id, n, title, kind, intro, children }: { id: string; n: number; title: string; kind: "fact" | "interpretation" | "hypothesis"; intro?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-6 border-t border-ink/80 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] font-semibold tabular-nums text-accent">{String(n).padStart(2, "0")}</p>
          <KindLabel kind={kind} />
        </div>
        <h2 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.025em] text-ink md:text-[32px]">{title}</h2>
        {intro && <p className="mt-2 text-[14px] text-muted">{intro}</p>}
      </div>
      <div className="space-y-7">{children}</div>
    </section>
  );
}

export function SingleFact({ item, large }: { item: SourcedText; large?: boolean }) {
  if (!item.text) return null;
  return (
    <p className={cn("text-ink", large ? "text-[17px] leading-relaxed" : "text-[15px] leading-relaxed")}>
      {item.text}
      <Cite ids={item.claim_ids} />
    </p>
  );
}

export function FactList({ title, items, empty }: { title?: string; items: SourcedText[]; empty?: string }) {
  if (!items.length && !empty) return null;
  return (
    <div>
      {title && <h4 className="mb-2 text-[14px] font-semibold text-ink">{title}</h4>}
      {items.length ? (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-ink/90">
              <span className="mt-[11px] h-1 w-1 shrink-0 rounded-full bg-ink/40" aria-hidden />
              <span>
                {it.text}
                <Cite ids={it.claim_ids} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] italic text-muted">{empty}</p>
      )}
    </div>
  );
}

export function PlaceGrid({ places, detailed, destination }: { places: PlaceItem[]; detailed?: boolean; destination: string }) {
  if (!places.length) return <p className="text-[14px] italic text-muted">No places could be supported by retrieved sources in this run.</p>;
  return (
    <div className="grid gap-x-6 gap-y-10 md:grid-cols-2">
      {places.map((p, i) => (
        <article key={p.name + i} className={cn("group", detailed && i % 3 === 0 && "md:col-span-2")}>
          <Photo image={p.image} label={p.name} className={cn("w-full rounded-[16px]", detailed && i % 3 === 0 ? "aspect-[16/8]" : "aspect-[4/3]")} attribution="hover" />
          <div className="mt-3">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-[19px] font-semibold leading-snug tracking-[-0.01em] text-ink">{p.name}</h3>
              <a
                href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(`${p.name} ${p.location || destination}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 shrink-0 text-muted hover:text-accent"
                title="Open in map"
                aria-label={`Open ${p.name} in a map`}
              >
                <MapPin className="h-4 w-4" />
              </a>
            </div>
            {p.location && <p className="text-[12px] uppercase tracking-[0.1em] text-muted">{p.location}</p>}
            <p className="mt-2 text-[14px] leading-relaxed text-ink/85">
              {p.description}
              <Cite ids={p.claim_ids} />
            </p>
            {detailed ? (
              <details className="group/d mt-2">
                <summary className="flex cursor-pointer list-none items-center gap-1 text-[13px] font-medium text-accent">
                  Details <ChevronDown className="h-3.5 w-3.5 transition-transform group-open/d:rotate-180" />
                </summary>
                <dl className="mt-2 grid gap-2 text-[13px]">
                  {(
                    [
                      ["Why it's special", p.why_special],
                      ["What makes it different", p.what_makes_it_different],
                      ["Activities", p.activities?.join(", ")],
                      ["Suitable for", p.traveller_segment],
                      ["Season", p.seasonality],
                      ["Access", p.accessibility],
                      ["For Indian travellers", p.india_relevance],
                    ] as const
                  )
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{k}</dt>
                        <dd className="text-ink/85">{v}</dd>
                      </div>
                    ))}
                </dl>
              </details>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.why_famous && <p className="w-full text-[13px] text-muted">{p.why_famous}</p>}
                {p.traveller_segment && <Badge>{p.traveller_segment}</Badge>}
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

export function FactsGrid({ facts }: { facts: SourcedText[] }) {
  if (!facts.length) return null;
  return (
    <ol className="grid gap-3 md:grid-cols-2">
      {facts.map((f, i) => (
        <li key={i} className={cn("rounded-[16px] p-5", ["bg-soft-blue/60", "bg-soft-mint/70", "bg-soft-peach/70", "bg-ink/[0.04]"][i % 4])}>
          <p className="text-[28px] font-semibold leading-none tracking-[-0.03em] text-ink/25">{String(i + 1).padStart(2, "0")}</p>
          <p className="mt-3 text-[15px] leading-relaxed text-ink">
            {f.text}
            <Cite ids={f.claim_ids} />
          </p>
        </li>
      ))}
    </ol>
  );
}

export function SourceLibrary({ sources, claims, order }: { sources: SourceRecord[]; claims: Claim[]; order: string[] }) {
  const cited = new Map<string, number>();
  claims.forEach((c) => c.evidence.filter((e) => e.quote_found).forEach((e) => cited.set(e.source_id, (cited.get(e.source_id) ?? 0) + 1)));
  const num = new Map(order.map((id, i) => [id, i + 1]));
  if (!sources.length) return <p className="text-sm text-muted">No sources stored.</p>;
  const row = (s: SourceRecord) => (
    <li key={s.id} className="flex gap-4 px-4 py-3">
      <span className="w-7 shrink-0 text-right text-[13px] font-semibold tabular-nums text-accent">{num.get(s.id)}</span>
      <div className="min-w-0 flex-1">
        <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-[14px] font-medium text-ink hover:text-accent">
          <span className="truncate">{s.title}</span> <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
        <p className="text-[12px] text-muted">
          {s.publisher} · {s.source_type.replace("_", " ")} · published {fmtDate(s.published_at)} · retrieved {fmtDate(s.retrieved_at)}
        </p>
      </div>
      <div className="shrink-0 text-right">{cited.get(s.id) ? <Badge tone="mint">Supports {cited.get(s.id)}</Badge> : <Badge>Retrieved, not cited</Badge>}</div>
    </li>
  );
  const used = sources.filter((s) => cited.get(s.id));
  const unused = sources.filter((s) => !cited.get(s.id));
  return (
    <div className="space-y-3">
      <ol className="divide-y divide-line rounded-[14px] border border-line bg-surface">{used.map(row)}</ol>
      {unused.length > 0 && (
        <details className="rounded-[14px] border border-line bg-surface">
          <summary className="cursor-pointer px-4 py-3 text-[13px] font-medium text-ink">Other retrieved sources, not cited ({unused.length})</summary>
          <ol className="divide-y divide-line border-t border-line">{unused.map(row)}</ol>
        </details>
      )}
    </div>
  );
}
