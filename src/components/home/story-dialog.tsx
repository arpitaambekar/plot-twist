"use client";
import Link from "next/link";
import { CalendarDays, Compass, ExternalLink, Users, Eye, EyeOff } from "lucide-react";
import type { NewsArticle } from "@/lib/types";
import { Dialog } from "@/components/ui/dialog";
import { Photo } from "@/components/media/photo";
import { Badge } from "@/components/ui/primitives";
import { buttonClasses } from "@/components/ui/button";
import { SaveButton } from "@/components/shared/save-button";
import { AddToOpportunity } from "@/components/shared/add-to-opportunity";
import { DemoBadge, KindLabel } from "@/components/sources/status-badge";
import { RelevanceDot } from "./news-card";
import { SOURCE_TYPE_LABEL } from "./shared";
import { fmtDate, fmtDateTime } from "@/lib/utils";

export function StoryDialog({
  story,
  saved,
  onClose,
  following,
  onFollow,
}: {
  story: NewsArticle | null;
  saved: boolean;
  onClose: () => void;
  following: (kind: "destination" | "tourism_board", value: string) => boolean;
  onFollow: (kind: "destination" | "tourism_board", value: string) => void;
}) {
  if (!story) return null;
  const dest = story.destinations[0] ?? "";
  const contactQuery = `${story.tourism_board ?? `${dest} tourism board`} India`;

  return (
    <Dialog open={Boolean(story)} onOpenChange={(o) => !o && onClose()} title={story.title} description={`${story.category}${story.destinations.length ? " · " + story.destinations.join(", ") : ""}`} wide>
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-xl">
          <Photo image={story.image} label={dest || story.category} className="h-56 w-full md:h-72" attribution="below" />
          {story.image?.is_destination_photo && <span className="absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] text-white backdrop-blur">Destination photo, not from the article</span>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="blue">{story.category}</Badge>
          {story.tourism_board && <Badge>{story.tourism_board}</Badge>}
          <RelevanceDot level={story.india_relevance} />
          {story.is_demo && <DemoBadge />}
        </div>

        <dl className="grid gap-3 rounded-xl border border-line bg-ivory/60 p-4 text-[13px] sm:grid-cols-3">
          <div>
            <dt className="text-muted">Published</dt>
            <dd className="font-medium text-ink">{fmtDate(story.published_at)}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-muted">
              <CalendarDays className="h-3.5 w-3.5" /> Event date
            </dt>
            <dd className="font-medium text-ink">{story.event_date ?? "Not stated in the story"}</dd>
          </div>
          <div>
            <dt className="text-muted">Source</dt>
            <dd className="font-medium text-ink">
              {story.source_name} <span className="font-normal text-muted">({SOURCE_TYPE_LABEL[story.source_type] ?? story.source_type})</span>
            </dd>
          </div>
          <div className="sm:col-span-3">
            <a href={story.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline">
              Open the original story <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <span className="ml-3 text-muted">Retrieved {fmtDateTime(story.retrieved_at)} via {story.via === "rss" ? "RSS feed" : story.via === "search" ? "news search" : "manual entry"}</span>
          </div>
        </dl>

        <section>
          <p className="eyebrow mb-2">Summary · from the source</p>
          <p className="text-[15px] leading-relaxed text-ink">{story.summary || "The source did not provide a summary. Open the original story."}</p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-line p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[14px] font-semibold text-ink">Why this matters</p>
              <KindLabel kind="interpretation" />
            </div>
            <p className="text-[14px] leading-relaxed text-ink/80">{story.why_it_matters ?? "AI analysis is not available for this story yet. It appears once OpenAI is configured and the next refresh runs."}</p>
          </div>
          <div className="rounded-xl border border-accent/20 bg-soft-blue/50 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[14px] font-semibold text-ink">
                The plot twist<span className="text-accent">.</span> take
              </p>
              <KindLabel kind="interpretation" />
            </div>
            <p className="text-[14px] leading-relaxed text-ink/80">{story.take ?? "No take yet. This is written by AI when configured, and is always labelled as interpretation, not fact."}</p>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-5">
          <SaveButton type="news" id={story.id} label={story.title} initial={saved} variant="button" />
          {dest && (
            <Link href={`/research?destination=${encodeURIComponent(dest)}`} className={buttonClasses("secondary")}>
              <Compass className="h-4 w-4" /> Research {dest}
            </Link>
          )}
          <AddToOpportunity
            label="Create opportunity"
            defaults={{ name: dest ? `${dest}: ${story.category.toLowerCase()} opening` : story.title.slice(0, 80), destination: dest || "Unknown", tourism_board: story.tourism_board, summary: story.summary }}
            links={{ news_ids: [story.id], source_links: [{ title: story.title, url: story.url }] }}
          />
          <Link href={`/contacts?q=${encodeURIComponent(contactQuery)}${dest ? `&destination=${encodeURIComponent(dest)}` : ""}`} className={buttonClasses("secondary")}>
            <Users className="h-4 w-4" /> Find contacts
          </Link>
          {dest && (
            <button onClick={() => onFollow("destination", dest)} className={buttonClasses("ghost")} aria-pressed={following("destination", dest)}>
              {following("destination", dest) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {following("destination", dest) ? `Unfollow ${dest}` : `Follow ${dest}`}
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
