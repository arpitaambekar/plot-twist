"use client";
import { ExternalLink } from "lucide-react";
import type { NewsArticle, OpportunitySignal, OutboundStat, WatchItem } from "@/lib/types";
import { Card } from "@/components/ui/primitives";
import { featuredScore } from "./shared";
import { fmtDate } from "@/lib/utils";

/** This Week in Travel: a compact digest of the last 7 days. Every factual line links to its source. */
export function WeeklyDigest({
  news,
  signals,
  stats,
  watchlist,
  savedDestinations,
  onOpen,
}: {
  news: NewsArticle[];
  signals: OpportunitySignal[];
  stats: OutboundStat[];
  watchlist: WatchItem[];
  savedDestinations: string[];
  onOpen: (id: string) => void;
}) {
  const weekAgo = Date.now() - 7 * 86400000;
  const week = news.filter((n) => new Date(n.published_at ?? n.retrieved_at).getTime() >= weekAgo);
  const top = [...week].sort((a, b) => featuredScore(b) - featuredScore(a)).slice(0, 3);
  const campaigns = week.filter((n) => n.category === "Tourism-board campaign" || n.category === "Board business").slice(0, 3);
  const events = news.filter((n) => n.category === "Events & festivals").slice(0, 3);
  const recentStats = [...stats].sort((a, b) => b.verified_at.localeCompare(a.verified_at)).slice(0, 2);

  const watchDest = new Set([...watchlist.filter((w) => w.kind === "destination").map((w) => w.value), ...savedDestinations]);
  const watchBoards = new Set(watchlist.filter((w) => w.kind === "tourism_board").map((w) => w.value));
  const watchCats = new Set(watchlist.filter((w) => w.kind === "category").map((w) => w.value));
  const indiaMarket = watchlist.some((w) => w.kind === "india_market");
  const alerts = week
    .filter((n) => n.destinations.some((d) => watchDest.has(d)) || (n.tourism_board && watchBoards.has(n.tourism_board)) || watchCats.has(n.category) || (indiaMarket && n.india_relevance === "High"))
    .slice(0, 4);

  const Story = ({ n, note }: { n: NewsArticle; note?: string }) => (
    <li>
      <div className="flex items-start gap-1.5">
        <button onClick={() => onOpen(n.id)} className="line-clamp-2 text-left text-[13px] leading-snug text-ink hover:text-accent">
          {n.title}
        </button>
        <a href={n.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 shrink-0 text-muted hover:text-accent" aria-label={`Source: ${n.source_name}`}>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      {note && <p className="text-[11px] text-muted">{note}</p>}
    </li>
  );

  const Block = ({ title, children, empty }: { title: string; children: React.ReactNode; empty: boolean }) => (
    <div className="border-t border-line py-4 first:border-0 first:pt-0">
      <p className="eyebrow mb-2 !text-[11px]">{title}</p>
      {empty ? <p className="text-[13px] text-muted">Nothing new this week.</p> : <ul className="space-y-2">{children}</ul>}
    </div>
  );

  return (
    <Card className="p-5">
      <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-ink">This Week in Travel</h2>
      <p className="mb-4 text-[12px] text-muted">The last seven days at a glance.</p>
      <Block title="Watchlist alerts" empty={!alerts.length}>
        {alerts.map((n) => (
          <Story key={n.id} n={n} />
        ))}
      </Block>
      <Block title="Top stories" empty={!top.length}>
        {top.map((n) => (
          <Story key={n.id} n={n} />
        ))}
      </Block>
      <Block title="Board campaigns and business" empty={!campaigns.length}>
        {campaigns.map((n) => (
          <Story key={n.id} n={n} />
        ))}
      </Block>
      <Block title="Opportunities" empty={!signals.length}>
        {signals.slice(0, 3).map((s) => (
          <li key={s.id} className="text-[13px] leading-snug text-ink">
            <span className="font-medium">{s.destination}:</span> {s.what_happened}
            <span className="ml-1 text-[11px] text-muted">({s.confidence.toLowerCase()})</span>
          </li>
        ))}
      </Block>
      <Block title="Events coming up" empty={!events.length}>
        {events.map((n) => (
          <Story key={n.id} n={n} note={`${n.event_date ? `Event date: ${n.event_date}` : "Event date not stated"} · announced ${fmtDate(n.published_at)}`} />
        ))}
      </Block>
      <Block title="Outbound statistics" empty={!recentStats.length}>
        {recentStats.map((s) => (
          <li key={s.id} className="text-[13px] text-ink">
            <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
              {s.destination}: {new Intl.NumberFormat("en-IN").format(s.value)} {s.unit}
            </a>
            <span className="block text-[11px] text-muted">
              {s.metric}, {s.reporting_period} · {s.publisher}
            </span>
          </li>
        ))}
      </Block>
    </Card>
  );
}
