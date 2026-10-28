import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getCurrentUser, hasRole } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { searchConfigured } from "@/lib/search";
import { activeNewsJob, lastNewsJob, newsIsStale, startNewsRefresh } from "@/lib/news/refresh";
import { Suspense } from "react";
import { HomeView } from "@/components/home/home-view";

export const metadata = { title: "Home" };
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = (await getCurrentUser())!;
  const store = db();
  const settings = await getSettings();

  // Keep the feed live without a cron locally: if cached news is older than the configured
  // interval, an editor's visit kicks off a background refresh (deduplicated).
  let running = await activeNewsJob();
  const feeds = await store.list("feeds");
  const canRetrieve = searchConfigured() || feeds.some((f) => f.enabled);
  if (!running && hasRole(user, "editor") && canRetrieve && (await newsIsStale())) {
    running = await startNewsRefresh(user.id);
  }

  const [news, stats, signals, saved, watchlist, destinations, last] = await Promise.all([
    store.list("news_articles", { orderBy: { column: "published_at" }, limit: 600 }),
    store.list("outbound_stats", { orderBy: { column: "created_at" } }),
    store.list("opportunity_signals", { orderBy: { column: "created_at" } }),
    store.list("saved_items", { where: { user_id: user.id, item_type: "news" } as never }),
    store.list("watchlist", { where: { user_id: user.id } as never }),
    store.list("destinations", { orderBy: { column: "name", ascending: true } }),
    lastNewsJob(),
  ]);

  // Demo fixtures never appear outside demo mode, so they can't leak into real work.
  const visibleNews = env.demoFixtures ? news : news.filter((n) => !n.is_demo);
  const visibleSignals = env.demoFixtures ? signals : signals.filter((s) => !s.is_demo);

  return (
    <Suspense>
    <HomeView
      news={visibleNews}
      stats={stats}
      signals={visibleSignals}
      savedIds={saved.map((s) => s.item_id)}
      watchlist={watchlist}
      destinations={destinations}
      lastRefreshAt={settings.last_news_refresh_at}
      lookbackDays={settings.news_lookback_days}
      runningJobId={running?.id ?? null}
      lastJob={last ? { status: last.status, error: last.error, message: last.log[last.log.length - 1]?.message ?? "" } : null}
      feeds={feeds.map((f) => ({ name: f.name, status: f.last_status, error: f.last_error }))}
      searchReady={searchConfigured()}
    />
    </Suspense>
  );
}
