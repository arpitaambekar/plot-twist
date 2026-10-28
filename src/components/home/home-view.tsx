"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List, SlidersHorizontal, Search, Newspaper, X } from "lucide-react";
import type { Destination, NewsArticle, OpportunitySignal, OutboundStat, WatchItem } from "@/lib/types";
import { PageHeader, EmptyState, Input, Select, Label, Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import { FeaturedStories } from "./featured";
import { NewsCard } from "./news-card";
import { StoryDialog } from "./story-dialog";
import { OutboundWatch } from "./outbound-watch";
import { OpportunitySignals } from "./signals";
import { WeeklyDigest } from "./digest";
import { WatchlistPanel } from "./watchlist-panel";
import { RefreshBar } from "./refresh-bar";
import { CATEGORY_TABS, DEFAULT_FILTERS, SOURCE_TYPE_LABEL, applyFilters, featuredScore, sortByDate, type DateRange, type NewsFilters } from "./shared";

const PAGE = 12;

export function HomeView(props: {
  news: NewsArticle[];
  stats: OutboundStat[];
  signals: OpportunitySignal[];
  savedIds: string[];
  watchlist: WatchItem[];
  destinations: Destination[];
  lastRefreshAt: string | null;
  lookbackDays: number;
  runningJobId: string | null;
  lastJob: { status: string; error: string | null; message: string } | null;
  feeds: { name: string; status: string; error: string | null }[];
  searchReady: boolean;
}) {
  const { news, destinations } = props;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();

  const [filters, setFilters] = useState<NewsFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [limit, setLimit] = useState(PAGE);
  const [watch, setWatch] = useState<WatchItem[]>(props.watchlist);
  const [extraStory, setExtraStory] = useState<NewsArticle | null>(null);
  const saved = useMemo(() => new Set(props.savedIds), [props.savedIds]);

  useEffect(() => setWatch(props.watchlist), [props.watchlist]);
  useEffect(() => {
    try {
      const v = localStorage.getItem("pt.home.layout");
      if (v === "list" || v === "grid") setLayout(v);
    } catch {}
  }, []);
  useEffect(() => setLimit(PAGE), [filters]);

  const newsById = useMemo(() => new Map(news.map((n) => [n.id, n])), [news]);
  const storyId = params.get("story");
  const story = storyId ? (newsById.get(storyId) ?? (extraStory?.id === storyId ? extraStory : null)) : null;

  // Deep links to a story outside the loaded window are fetched on demand.
  useEffect(() => {
    if (!storyId || newsById.has(storyId)) return;
    api<{ article: NewsArticle }>(`/api/news/${storyId}`)
      .then((r) => setExtraStory(r.article))
      .catch(() => toast("That story is no longer available.", "error"));
  }, [storyId, newsById, toast]);

  const openStory = useCallback(
    (id: string) => {
      const sp = new URLSearchParams(params.toString());
      sp.set("story", id);
      router.push(`${pathname}?${sp}`, { scroll: false });
    },
    [params, pathname, router],
  );
  const closeStory = () => {
    const sp = new URLSearchParams(params.toString());
    sp.delete("story");
    router.replace(sp.toString() ? `${pathname}?${sp}` : pathname, { scroll: false });
  };

  const following = (kind: WatchItem["kind"], value: string) => watch.some((w) => w.kind === kind && w.value === value);
  async function toggleWatch(kind: WatchItem["kind"], value: string) {
    try {
      const r = await api<{ following: boolean; item?: WatchItem }>("/api/watchlist", { json: { kind, value } });
      setWatch((w) => (r.following && r.item ? [...w, r.item] : w.filter((x) => !(x.kind === kind && x.value === value))));
      toast(r.following ? `Following ${value}.` : `Unfollowed ${value}.`, r.following ? "success" : "info");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  const sorted = useMemo(() => sortByDate(news), [news]);
  const filtered = useMemo(() => applyFilters(sorted, filters, saved), [sorted, filters, saved]);
  const featured = useMemo(() => {
    const pool = applyFilters(sorted, { ...DEFAULT_FILTERS, range: "30" }, saved);
    return [...(pool.length ? pool : sorted)].sort((a, b) => featuredScore(b) - featuredScore(a)).slice(0, 5);
  }, [sorted, saved]);
  const featuredIds = new Set(filters === DEFAULT_FILTERS ? featured.map((f) => f.id) : []);
  const grid = filtered.filter((n) => !featuredIds.has(n.id));
  const counts = useMemo(() => {
    const base = applyFilters(sorted, filters, saved, true);
    const c: Record<string, number> = { All: base.length };
    for (const n of base) c[n.category] = (c[n.category] ?? 0) + 1;
    return c;
  }, [sorted, filters, saved]);

  const boards = useMemo(() => [...new Set([...news.map((n) => n.tourism_board), ...destinations.map((d) => d.tourism_board)].filter(Boolean) as string[])].sort(), [news, destinations]);
  const newsDestinations = useMemo(() => [...new Set([...destinations.map((d) => d.name), ...news.flatMap((n) => n.destinations)])].sort(), [news, destinations]);
  const continents = useMemo(() => [...new Set([...destinations.map((d) => d.continent), ...(news.map((n) => n.continent).filter(Boolean) as string[])])].sort(), [news, destinations]);
  const savedDestinations = useMemo(() => [...new Set(news.filter((n) => saved.has(n.id)).flatMap((n) => n.destinations))], [news, saved]);
  const activeFilterCount = (["destination", "continent", "board", "relevance", "sourceType"] as const).filter((k) => filters[k]).length + (filters.savedOnly ? 1 : 0) + (filters.range !== "30" ? 1 : 0);

  const set = <K extends keyof NewsFilters>(k: K, v: NewsFilters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const setLayoutPersist = (l: "grid" | "list") => {
    setLayout(l);
    try {
      localStorage.setItem("pt.home.layout", l);
    } catch {}
  };

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="The Latest Plot"
        title="What's happening in travel?"
        subtitle="The stories, shifts and opportunities worth knowing."
        actions={<RefreshBar lastRefreshAt={props.lastRefreshAt} runningJobId={props.runningJobId} lastJob={props.lastJob} feeds={props.feeds} searchReady={props.searchReady} />}
      />

      {news.length === 0 ? (
        <EmptyState
          icon={<Newspaper className="h-6 w-6" />}
          title="No new plot twists just yet."
          body={
            props.runningJobId
              ? "A refresh is running. Stories appear here as soon as they are retrieved and checked."
              : "No verified stories have been retrieved yet. Stories only appear when they come from a real feed or news search, never made up to fill the page."
          }
        />
      ) : (
        <>
          <FeaturedStories stories={featured} saved={saved} onOpen={openStory} />

          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section aria-labelledby="latest-title" className="min-w-0">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="eyebrow mb-1.5">Latest Travel Updates</p>
                  <h2 id="latest-title" className="text-[21px] font-semibold tracking-[-0.01em] text-ink">
                    {filtered.length} {filtered.length === 1 ? "story" : "stories"}
                    <span className="ml-2 text-[14px] font-normal text-muted">{rangeLabel(filters)}</span>
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                    <Input value={filters.q} onChange={(e) => set("q", e.target.value)} placeholder="Filter stories" className="h-9 w-44 pl-8 text-[13px]" aria-label="Filter stories by text" />
                  </div>
                  <Button variant={showFilters || activeFilterCount ? "primary" : "secondary"} size="sm" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
                    <SlidersHorizontal className="h-4 w-4" /> Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
                  </Button>
                  <div className="inline-flex rounded-full border border-line bg-surface p-0.5" role="group" aria-label="Layout">
                    {(["grid", "list"] as const).map((l) => (
                      <button key={l} onClick={() => setLayoutPersist(l)} aria-pressed={layout === l} aria-label={`${l} view`} className={cn("rounded-full p-1.5", layout === l ? "bg-ink text-white" : "text-muted hover:text-ink")}>
                        {l === "grid" ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="scrollbar-thin -mx-1 mb-5 flex gap-1 overflow-x-auto border-b border-line px-1" role="tablist" aria-label="News categories">
                {CATEGORY_TABS.map((t) => (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={filters.category === t.key}
                    onClick={() => set("category", t.key)}
                    className={cn(
                      "-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] transition-colors",
                      filters.category === t.key ? "border-ink font-medium text-ink" : "border-transparent text-muted hover:text-ink",
                    )}
                  >
                    {t.label}
                    <span className="ml-1.5 text-[11px] text-muted">{counts[t.key] ?? 0}</span>
                  </button>
                ))}
              </div>

              {showFilters && (
                <Card className="mb-6 p-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <FilterSelect label="Destination / country" value={filters.destination} onChange={(v) => set("destination", v)} options={newsDestinations} />
                    <FilterSelect label="Continent" value={filters.continent} onChange={(v) => set("continent", v)} options={continents} />
                    <FilterSelect label="Tourism board" value={filters.board} onChange={(v) => set("board", v)} options={boards} />
                    <FilterSelect label="India relevance" value={filters.relevance} onChange={(v) => set("relevance", v as NewsFilters["relevance"])} options={["High", "Medium", "Low"]} />
                    <FilterSelect label="Source type" value={filters.sourceType} onChange={(v) => set("sourceType", v)} options={Object.keys(SOURCE_TYPE_LABEL)} labels={SOURCE_TYPE_LABEL} />
                    <div>
                      <Label htmlFor="f-range">Published</Label>
                      <Select id="f-range" value={filters.range} onChange={(e) => set("range", e.target.value as DateRange)}>
                        <option value="today">Today</option>
                        <option value="7">Last 7 days</option>
                        <option value="30">Last 30 days</option>
                        <option value="90">Last 90 days</option>
                        <option value="custom">Custom range</option>
                      </Select>
                    </div>
                    {filters.range === "custom" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor="f-from">From</Label>
                          <Input id="f-from" type="date" value={filters.from} onChange={(e) => set("from", e.target.value)} />
                        </div>
                        <div>
                          <Label htmlFor="f-to">To</Label>
                          <Input id="f-to" type="date" value={filters.to} onChange={(e) => set("to", e.target.value)} />
                        </div>
                      </div>
                    )}
                    <label className="flex items-center gap-2 self-end pb-2 text-[13px] text-ink">
                      <input type="checkbox" checked={filters.savedOnly} onChange={(e) => set("savedOnly", e.target.checked)} className="h-4 w-4 accent-[#4169D7]" />
                      Saved stories only
                    </label>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button onClick={() => setFilters({ ...DEFAULT_FILTERS, category: filters.category })} className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
                      <X className="h-3.5 w-3.5" /> Clear filters
                    </button>
                  </div>
                </Card>
              )}

              {grid.length === 0 ? (
                <EmptyState
                  title="No new plot twists just yet."
                  body={filtered.length ? "The matching stories are already featured above." : "Nothing matches these filters. Try a longer date range or clear filters."}
                  action={
                    <Button variant="secondary" onClick={() => setFilters(DEFAULT_FILTERS)}>
                      Clear filters
                    </Button>
                  }
                />
              ) : layout === "grid" ? (
                <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
                  {grid.slice(0, limit).map((n) => (
                    <NewsCard key={n.id} n={n} layout="grid" saved={saved.has(n.id)} onOpen={() => openStory(n.id)} />
                  ))}
                </div>
              ) : (
                <div className="rounded-[14px] border border-line bg-surface px-4">
                  {grid.slice(0, limit).map((n) => (
                    <NewsCard key={n.id} n={n} layout="list" saved={saved.has(n.id)} onOpen={() => openStory(n.id)} />
                  ))}
                </div>
              )}
              {grid.length > limit && (
                <div className="mt-8 flex justify-center">
                  <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE)}>
                    Show more stories ({grid.length - limit} more)
                  </Button>
                </div>
              )}
            </section>

            <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
              <WeeklyDigest news={sorted} signals={props.signals} stats={props.stats} watchlist={watch} savedDestinations={savedDestinations} onOpen={openStory} />
              <WatchlistPanel items={watch} destinations={destinations} boards={boards} onToggle={toggleWatch} />
            </aside>
          </div>
        </>
      )}

      <OpportunitySignals signals={props.signals} newsById={newsById} onOpen={openStory} />
      <OutboundWatch stats={props.stats} />

      <StoryDialog story={story} saved={story ? saved.has(story.id) : false} onClose={closeStory} following={following} onFollow={toggleWatch} />
    </div>
  );
}

function rangeLabel(f: NewsFilters) {
  if (f.range === "today") return "today";
  if (f.range === "custom") return f.from || f.to ? `${f.from || "…"} to ${f.to || "today"}` : "custom range";
  return `in the last ${f.range} days`;
}

function FilterSelect({ label, value, onChange, options, labels }: { label: string; value: string; onChange: (v: string) => void; options: string[]; labels?: Record<string, string> }) {
  const id = `f-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {labels?.[o] ?? o}
          </option>
        ))}
      </Select>
    </div>
  );
}
