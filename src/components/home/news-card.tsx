"use client";
import { ExternalLink } from "lucide-react";
import type { NewsArticle } from "@/lib/types";
import { Photo } from "@/components/media/photo";
import { Badge } from "@/components/ui/primitives";
import { SaveButton } from "@/components/shared/save-button";
import { DemoBadge } from "@/components/sources/status-badge";
import { fmtDate, cn } from "@/lib/utils";

export function RelevanceDot({ level }: { level: NewsArticle["india_relevance"] }) {
  const map = { High: "bg-accent", Medium: "bg-[#8aa3e8]", Low: "bg-ink/20" };
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted" title="India relevance (rule-based)">
      <span className={cn("h-1.5 w-1.5 rounded-full", map[level])} aria-hidden />
      India: {level}
    </span>
  );
}

function Meta({ n }: { n: NewsArticle }) {
  return (
    <p className="text-[12px] text-muted">
      <span className="font-medium text-ink/80">{n.source_name}</span> · {fmtDate(n.published_at)}
    </p>
  );
}

export function NewsCard({ n, saved, onOpen, layout }: { n: NewsArticle; saved: boolean; onOpen: () => void; layout: "grid" | "list" }) {
  const dest = n.destinations[0];
  const photoLabel = dest ?? n.category;

  if (layout === "list") {
    return (
      <article className="group flex gap-4 border-b border-line py-4 last:border-0">
        <button onClick={onOpen} className="shrink-0 overflow-hidden rounded-xl" aria-label={`Open: ${n.title}`}>
          <Photo image={n.image} label={photoLabel} className="h-20 w-28 md:h-24 md:w-36" imgClassName="transition-transform duration-500 group-hover:scale-[1.03]" attribution="none" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-medium text-accent">{n.category}</span>
            {dest && <span className="text-[12px] text-muted">· {n.destinations.join(", ")}</span>}
            {n.is_demo && <DemoBadge />}
          </div>
          <button onClick={onOpen} className="block text-left">
            <h3 className="text-[16px] font-semibold leading-snug text-ink group-hover:text-accent">{n.title}</h3>
          </button>
          <p className="mt-1 line-clamp-2 text-[14px] text-muted">{n.summary}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <Meta n={n} />
            <RelevanceDot level={n.india_relevance} />
            <a href={n.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline">
              Source <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
        <SaveButton type="news" id={n.id} label={n.title} initial={saved} className="shrink-0 border border-line" />
      </article>
    );
  }

  return (
    <article className="group flex flex-col">
      <div className="relative">
        <button onClick={onOpen} className="block w-full overflow-hidden rounded-[14px]" aria-label={`Open: ${n.title}`}>
          <Photo image={n.image} label={photoLabel} className="aspect-[4/3] w-full" imgClassName="transition-transform duration-700 group-hover:scale-[1.04]" attribution="none" />
        </button>
        <div className="absolute right-2.5 top-2.5">
          <SaveButton type="news" id={n.id} label={n.title} initial={saved} />
        </div>
        {n.image?.is_destination_photo && (
          <span className="absolute bottom-2 left-2 rounded-full bg-black/45 px-2 py-0.5 text-[10px] text-white backdrop-blur" title={n.image.alt}>
            Destination photo
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-medium text-accent">{n.category}</span>
        {dest && <span className="text-[12px] text-muted">· {n.destinations.slice(0, 2).join(", ")}</span>}
        {n.is_demo && <DemoBadge />}
      </div>
      <button onClick={onOpen} className="mt-1 text-left">
        <h3 className="line-clamp-3 text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ink group-hover:text-accent">{n.title}</h3>
      </button>
      <p className="mt-1.5 line-clamp-2 text-[14px] text-muted">{n.summary}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
        <Meta n={n} />
        <div className="flex items-center gap-3">
          <RelevanceDot level={n.india_relevance} />
          <a href={n.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline" aria-label={`Open original source: ${n.source_name}`}>
            Source <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </article>
  );
}

export function CategoryBadge({ n }: { n: NewsArticle }) {
  return <Badge tone="blue">{n.category}</Badge>;
}
