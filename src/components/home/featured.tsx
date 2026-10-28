"use client";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { NewsArticle } from "@/lib/types";
import { Photo } from "@/components/media/photo";
import { SaveButton } from "@/components/shared/save-button";
import { DemoBadge } from "@/components/sources/status-badge";
import { RelevanceDot } from "./news-card";
import { fmtDate, cn } from "@/lib/utils";

/** Featured Stories: an editorial cover story with a quiet carousel through the top 3 to 5. */
export function FeaturedStories({ stories, saved, onOpen }: { stories: NewsArticle[]; saved: Set<string>; onOpen: (id: string) => void }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = stories.length;
  useEffect(() => {
    if (n < 2 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setI((x) => (x + 1) % n), 8000);
    return () => clearTimeout(t);
  }, [i, n, paused]);
  useEffect(() => setI(0), [n]);
  if (!n) return null;
  const s = stories[Math.min(i, n - 1)];

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured stories"
      className="relative overflow-hidden rounded-[22px] border border-line bg-surface shadow-[var(--shadow-card)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") setI((x) => (x + 1) % n);
        if (e.key === "ArrowLeft") setI((x) => (x - 1 + n) % n);
      }}
    >
      <div className="grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div key={s.id} className="flex animate-fade-up flex-col p-6 md:p-10">
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <span className="font-semibold uppercase tracking-[0.12em] text-accent">Featured</span>
            <span className="text-muted">· {fmtDate(s.published_at)}</span>
            {s.is_demo && <DemoBadge />}
          </div>
          <p className="mt-5 text-[13px] font-medium text-muted">
            {s.category}
            {s.destinations.length ? ` · ${s.destinations.join(", ")}` : ""}
          </p>
          <button onClick={() => onOpen(s.id)} className="mt-2 text-left">
            <h2 className="line-clamp-4 text-[24px] font-semibold leading-[1.18] tracking-[-0.025em] text-ink hover:text-accent md:text-[28px]">{s.title}</h2>
          </button>
          <p className="mt-4 line-clamp-3 text-[15px] leading-relaxed text-muted">{s.summary}</p>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-muted">
            <span>
              Source: <span className="font-medium text-ink/80">{s.source_name}</span>
            </span>
            <RelevanceDot level={s.india_relevance} />
          </div>
          <div className="mt-auto flex items-center gap-3 pt-8">
            <button onClick={() => onOpen(s.id)} className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-white transition-colors hover:bg-accent">
              Read the story <ArrowRight className="h-4 w-4" />
            </button>
            <SaveButton type="news" id={s.id} label={s.title} initial={saved.has(s.id)} variant="button" />
          </div>
        </div>
        <button onClick={() => onOpen(s.id)} className="relative order-first block min-h-[240px] md:order-none md:min-h-[440px]" aria-label={`Open: ${s.title}`}>
          <Photo key={s.id} image={s.image} label={s.destinations[0] ?? s.category} className="absolute inset-0 h-full w-full animate-fade-up" attribution="hover" eager />
          {s.image?.is_destination_photo && (
            <span className="absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] text-white backdrop-blur">Destination photo, not from the article</span>
          )}
        </button>
      </div>
      {n > 1 && (
        <div className="flex items-center justify-between border-t border-line px-6 py-3 md:px-10">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Choose featured story">
            {stories.map((st, idx) => (
              <button
                key={st.id}
                role="tab"
                aria-selected={idx === i}
                aria-label={`Story ${idx + 1}: ${st.title}`}
                onClick={() => setI(idx)}
                className={cn("h-1.5 rounded-full transition-all", idx === i ? "w-8 bg-ink" : "w-3 bg-ink/15 hover:bg-ink/30")}
              />
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="mr-2 text-[12px] tabular-nums text-muted">
              {String(i + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
            </span>
            <button onClick={() => setI((x) => (x - 1 + n) % n)} className="rounded-full p-2 text-ink hover:bg-ink/5" aria-label="Previous story">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setI((x) => (x + 1) % n)} className="rounded-full p-2 text-ink hover:bg-ink/5" aria-label="Next story">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
