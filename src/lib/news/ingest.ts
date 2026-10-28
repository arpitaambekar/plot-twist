import "server-only";
import Parser from "rss-parser";
import { z } from "zod";
import { db, newId, nowIso } from "@/lib/db";
import { env } from "@/lib/env";
import { generateStructured } from "@/lib/ai/openai";
import { webSearch, searchConfigured, normaliseDate } from "@/lib/search";
import { findPhoto } from "@/lib/images";
import { asUntrustedBlock, hostOf, safeUrl, sanitizeExternalText } from "@/lib/security/content";
import { recordUsage } from "@/lib/security/rate-limit";
import { getSettings, updateSettings } from "@/lib/settings";
import { setJobStage } from "@/lib/jobs";
import { classifySourceType } from "@/lib/evidence";
import { demoStories } from "@/lib/fixtures/news";
import { canonicalUrl, classifyArticle, titleKey } from "./classify";
import type { Destination, FeedConfig, ImageRef, NewsArticle, OpportunitySignal, ResearchJob } from "@/lib/types";

/** A story as retrieved, before classification. All text is untrusted and sanitised. */
export interface RawStory {
  url: string;
  title: string;
  summary: string;
  content: string;
  published_at: string | null;
  publisher: string;
  source_name: string;
  image_url: string | null;
  via: "rss" | "search";
  is_demo: boolean;
}

const MAX_AGE_DAYS = 90;
const UA = "plot-twist-internal/1.0 (travel news reader)";

/** Search queries for the live news sweep (topic: news). */
function searchQueries(year: number, watched: string[]): string[] {
  return [
    "tourism board India campaign launch Indian travellers",
    "tourism board appoints India representation agency",
    "new direct flights from India international route launch",
    "visa rules Indian passport holders new e-visa",
    `Indian tourist arrivals growth ${year}`,
    "tourism roadshow India Mumbai Delhi Bengaluru",
    "tourism board partnership India travel platform co-marketing",
    "international festival major event tourism announced Indian visitors",
    "tourism investment new attractions destination development shoulder season",
    ...watched.slice(0, 5).map((d) => `${d} tourism India`),
  ];
}

/* ------------------------------------------------------------------ retrieval */

const parser = new Parser({
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail"],
    ],
  },
});

type FeedItem = Parser.Item & { mediaContent?: { $?: { url?: string; medium?: string } }[]; mediaThumbnail?: { $?: { url?: string } }; enclosure?: { url?: string; type?: string } };

async function readFeed(feed: FeedConfig): Promise<RawStory[]> {
  const res = await fetch(feed.url, { headers: { "User-Agent": UA, Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  if (xml.length > 5_000_000) throw new Error("Feed too large");
  const parsed = await parser.parseString(xml);
  return (parsed.items as FeedItem[])
    .map((it) => {
      const url = safeUrl(it.link);
      if (!url || !it.title) return null;
      const img = it.mediaContent?.find((m) => m.$?.url && m.$.medium !== "video")?.$?.url ?? it.mediaThumbnail?.$?.url ?? (it.enclosure?.type?.startsWith("image") ? it.enclosure.url : undefined);
      const text = sanitizeExternalText(it.contentSnippet || it.content || it.summary || "", 1500);
      return {
        url,
        title: sanitizeExternalText(it.title, 300),
        summary: text.slice(0, 600),
        content: text,
        published_at: normaliseDate(it.isoDate ?? it.pubDate ?? null),
        publisher: feed.publisher,
        source_name: feed.name,
        image_url: safeUrl(img ?? null),
        via: "rss" as const,
        is_demo: false,
      };
    })
    .filter(Boolean) as RawStory[];
}

/* ------------------------------------------------------------------ AI enrichment */

const EnrichSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      summary: z.string().max(700),
      event_date: z.string().nullable(),
      why_it_matters: z.string().max(700),
      take: z.string().max(700),
    }),
  ),
});

async function enrich(articles: NewsArticle[], userId: string) {
  const store = db();
  for (let i = 0; i < articles.length; i += 10) {
    const batch = articles.slice(i, i + 10);
    const out = await generateStructured({
      task: "news.enrich",
      schema: EnrichSchema,
      userId,
      system: [
        "You annotate travel-industry news for an Indian travel platform's marketing and tourism-partnerships team.",
        "For each article: summary = one or two factual sentences using ONLY the article text. event_date = the date of the event itself if the text states one (as written, or ISO), otherwise null; never use the publication date as the event date.",
        "why_it_matters = why this matters for Indian outbound travel, grounded in the text; if the link to India is weak, say so plainly.",
        "take = 'The plot twist. take': a short, clearly hypothetical strategic interpretation of a marketing or partnership opportunity for Scapia (an Indian travel platform with a travel credit card). Use hedged language (could, may). Never claim a partnership exists.",
        "Return every id you were given.",
      ].join("\n"),
      user: batch
        .map((a) => `id: ${a.id}\npublisher: ${a.publisher}\npublished: ${a.published_at ?? "unknown"}\n${asUntrustedBlock(a.id, `${a.title}\n${a.summary}`)}`)
        .join("\n\n"),
      fixture: () => ({
        items: batch.map((a) => ({
          id: a.id,
          summary: a.summary,
          event_date: null,
          why_it_matters: "[DEMO] Placeholder analysis generated by offline fixtures. Not real analysis.",
          take: "[DEMO] Placeholder strategic interpretation from offline fixtures.",
        })),
      }),
    });
    for (const r of out.items) {
      const a = batch.find((x) => x.id === r.id);
      if (!a) continue;
      await store.update("news_articles", a.id, {
        summary: a.summary.length >= 80 ? a.summary : sanitizeExternalText(r.summary, 700),
        event_date: r.event_date ? sanitizeExternalText(r.event_date, 60) : null,
        why_it_matters: sanitizeExternalText(r.why_it_matters, 700),
        take: sanitizeExternalText(r.take, 700),
      });
    }
  }
}

/* ------------------------------------------------------------------ opportunity signals */

const SignalSchema = z.object({
  signals: z.array(
    z.object({
      destination: z.string(),
      what_happened: z.string().max(400),
      evidence_news_ids: z.array(z.string()).min(1),
      why_it_matters: z.string().max(600),
      time_sensitivity: z.enum(["Act now", "This quarter", "Watch"]),
      next_action: z.string().max(300),
      confidence: z.enum(["Confirmed activity", "Speculative opportunity"]),
    }),
  ),
});

/** AI-assisted signals derived only from stored, sourced news. Signals without valid evidence are dropped. */
export async function generateSignals(userId: string): Promise<OpportunitySignal[]> {
  const store = db();
  const since = Date.now() - 45 * 86400000;
  const news = (await store.list("news_articles", { orderBy: { column: "published_at" }, limit: 400 }))
    .filter((n) => n.india_relevance !== "Low" && n.category !== "Industry" && (!n.published_at || new Date(n.published_at).getTime() >= since))
    .filter((n) => (env.demoFixtures ? true : !n.is_demo))
    .slice(0, 25);
  if (!news.length) return [];
  const out = await generateStructured({
    task: "news.signals",
    schema: SignalSchema,
    userId,
    system: [
      "From the news items provided, identify up to 6 partnership or marketing opportunities for Scapia's tourism-partnerships team (an Indian travel platform).",
      "Each signal must cite the ids of the news items it is based on (evidence_news_ids). Only use ids provided.",
      "confidence = 'Confirmed activity' when the item itself reports that something happened (a campaign launched, a representative appointed, a route announced). Use 'Speculative opportunity' when the opportunity is your inference.",
      "what_happened must restate only what the evidence says. why_it_matters and next_action are interpretation. Never claim Scapia has a relationship with any board.",
      "time_sensitivity: 'Act now' for imminent windows or new appointments, 'This quarter' for upcoming campaigns/events, 'Watch' otherwise.",
    ].join("\n"),
    user: news
      .map((n) => `id: ${n.id}\ndestination(s): ${n.destinations.join(", ") || "unknown"}\ncategory: ${n.category}\npublished: ${n.published_at ?? "unknown"}\n${asUntrustedBlock(n.id, `${n.title}\n${n.summary}`)}`)
      .join("\n\n"),
    fixture: () => ({
      signals: news.slice(0, 3).map((n, i) => ({
        destination: n.destinations[0] ?? "Unknown",
        what_happened: `[DEMO] ${n.title.replace("[DEMO] ", "")}`,
        evidence_news_ids: [n.id],
        why_it_matters: "[DEMO] Placeholder reasoning from offline fixtures.",
        time_sensitivity: (["Act now", "This quarter", "Watch"] as const)[i % 3],
        next_action: "Research the destination and check the board's India activity.",
        confidence: i === 0 ? ("Confirmed activity" as const) : ("Speculative opportunity" as const),
      })),
    }),
  });
  const byId = new Map(news.map((n) => [n.id, n]));
  const signals: OpportunitySignal[] = out.signals
    .map((s) => {
      const ids = s.evidence_news_ids.filter((id) => byId.has(id));
      if (!ids.length) return null;
      return {
        id: newId("sig_"),
        destination: sanitizeExternalText(s.destination, 80),
        what_happened: sanitizeExternalText(s.what_happened, 400),
        evidence_news_ids: ids,
        evidence_urls: ids.map((id) => byId.get(id)!.url),
        why_it_matters: sanitizeExternalText(s.why_it_matters, 600),
        time_sensitivity: s.time_sensitivity,
        next_action: sanitizeExternalText(s.next_action, 300),
        confidence: s.confidence,
        created_at: nowIso(),
        is_demo: ids.some((id) => byId.get(id)!.is_demo),
      };
    })
    .filter(Boolean) as OpportunitySignal[];
  // Replace the previous generation; signals are a derived view of current news.
  for (const old of await store.list("opportunity_signals", { limit: 500 })) await store.remove("opportunity_signals", old.id);
  await store.insertMany("opportunity_signals", signals);
  return signals;
}

/* ------------------------------------------------------------------ main ingestion */

export interface IngestResult {
  added: number;
  duplicates: number;
  feedsOk: number;
  feedsFailed: number;
  searchUsed: boolean;
  errors: string[];
}

export async function ingestNews(userId: string, onStage: (stage: "finding_sources" | "extracting_facts" | "generating_report", msg: string) => Promise<void>): Promise<IngestResult> {
  const store = db();
  const settings = await getSettings();
  const directory = await store.list("destinations");
  const errors: string[] = [];
  const raw: RawStory[] = [];
  let feedsOk = 0;
  let feedsFailed = 0;

  // 1. RSS feeds from the admin-managed list. Each feed's real status is recorded.
  const feeds = (await store.list("feeds")).filter((f) => f.enabled);
  await onStage("finding_sources", `Reading ${feeds.length} feed(s)`);
  await Promise.all(
    feeds.map(async (f) => {
      try {
        const items = await readFeed(f);
        raw.push(...items);
        feedsOk++;
        await store.update("feeds", f.id, { last_status: "ok", last_checked_at: nowIso(), last_error: null, item_count: items.length });
      } catch (e) {
        feedsFailed++;
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${f.name}: ${msg}`);
        await store.update("feeds", f.id, { last_status: "failed", last_checked_at: nowIso(), last_error: msg.slice(0, 300) });
      }
    }),
  );

  // 2. Live search sweep (news topic), plus watched destinations.
  let searchUsed = false;
  if (env.demoFixtures && !env.tavilyKey && !env.braveKey) {
    searchUsed = true;
    raw.push(...demoStories());
  } else if (searchConfigured()) {
    searchUsed = true;
    const watched = [...new Set((await store.list("watchlist", { where: { kind: "destination" } as never })).map((w) => w.value))];
    const queries = searchQueries(new Date().getFullYear(), watched);
    await onStage("finding_sources", `Searching ${queries.length} news queries`);
    for (const q of queries) {
      try {
        const results = await webSearch(q, { topic: "news", days: settings.news_lookback_days, maxResults: 6, userId });
        raw.push(
          ...results.map((r) => ({
            url: r.url,
            title: r.title,
            summary: r.snippet.slice(0, 600),
            content: r.content,
            published_at: r.published_at,
            publisher: r.publisher,
            source_name: r.publisher,
            image_url: r.image ? safeUrl(r.image) : null,
            via: "search" as const,
            is_demo: r.provider === "demo",
          })),
        );
      } catch (e) {
        errors.push(`Search "${q}": ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  // 3. Deduplicate (canonical URL + normalised title), classify, store.
  await onStage("extracting_facts", `Classifying and de-duplicating ${raw.length} retrieved item(s)`);
  const existing = await store.list("news_articles", { limit: 5000 });
  const seenKeys = new Set(existing.map((a) => a.dedupe_key));
  const seenUrls = new Set(existing.map((a) => canonicalUrl(a.url)));
  const blocked = new Set(settings.blocked_domains.map((d) => d.replace(/^www\./, "")));
  const cutoff = Date.now() - MAX_AGE_DAYS * 86400000;
  const fresh: NewsArticle[] = [];
  let duplicates = 0;

  for (const r of raw) {
    if (!r.title || blocked.has(hostOf(r.url))) continue;
    if (r.published_at && new Date(r.published_at).getTime() < cutoff) continue;
    const key = titleKey(r.title);
    const cu = canonicalUrl(r.url);
    if (!key || seenKeys.has(key) || seenUrls.has(cu)) {
      duplicates++;
      continue;
    }
    seenKeys.add(key);
    seenUrls.add(cu);
    const c = classifyArticle(r.title, r.summary, directory);
    fresh.push({
      id: newId("news_"),
      url: r.url,
      title: r.title,
      summary: r.summary,
      image: r.image_url
        ? { url: r.image_url, alt: r.title, provider: r.publisher, author: null, license: "Publisher image via feed", license_url: null, source_page: r.url }
        : null,
      source_name: r.source_name,
      publisher: r.publisher,
      source_type: r.is_demo ? "trade" : classifySourceType(r.url, directory.map((d) => d.board_website ?? "").filter(Boolean)),
      published_at: r.published_at,
      retrieved_at: nowIso(),
      event_date: null,
      destinations: c.destinations,
      continent: c.continent,
      category: c.category,
      tourism_board: c.tourism_board,
      india_relevance: c.india_relevance,
      why_it_matters: null,
      take: null,
      dedupe_key: key,
      via: r.via,
      is_demo: r.is_demo,
    });
  }

  // Destination photos (clearly labelled) for stories without their own image.
  await attachDestinationPhotos(fresh, directory);
  await store.insertMany("news_articles", fresh);

  // 4. AI enrichment for the most relevant new stories, then refreshed signals.
  if (fresh.length && (env.openaiKey || env.demoFixtures)) {
    await onStage("generating_report", "Writing summaries, why-it-matters notes and opportunity signals");
    const priority = fresh.filter((a) => a.india_relevance !== "Low").slice(0, 30);
    try {
      await enrich(priority, userId);
    } catch (e) {
      errors.push(`AI enrichment: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (env.openaiKey || env.demoFixtures) {
    try {
      await generateSignals(userId);
    } catch (e) {
      errors.push(`Opportunity signals: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  await recordUsage(userId, "news_refresh", 1, { added: fresh.length });
  return { added: fresh.length, duplicates, feedsOk, feedsFailed, searchUsed, errors };
}

async function attachDestinationPhotos(articles: NewsArticle[], directory: Destination[]) {
  const cache = new Map<string, ImageRef | null>();
  for (const a of articles) {
    if (a.image) continue;
    const d = directory.find((x) => x.name === a.destinations[0]);
    if (!d) continue;
    if (!cache.has(d.name)) {
      const img = await Promise.race([findPhoto(d.photo_query, { file: d.photo_file, alt: d.name }), new Promise<null>((r) => setTimeout(() => r(null), 8000))]);
      cache.set(d.name, img);
    }
    const img = cache.get(d.name);
    if (img) a.image = { ...img, alt: `Destination photo: ${d.name} (not from the article)`, is_destination_photo: true };
  }
}

/** Job handler (registered in lib/jobs/handlers.ts). */
export async function runNewsJob(job: ResearchJob): Promise<void> {
  const result = await ingestNews(job.created_by, (stage, msg) => setJobStage(job.id, stage, msg));
  await updateSettings({ last_news_refresh_at: nowIso() });
  const summary = `Added ${result.added} new stor${result.added === 1 ? "y" : "ies"}, skipped ${result.duplicates} duplicate(s). Feeds OK: ${result.feedsOk}, failed: ${result.feedsFailed}.${result.searchUsed ? "" : " Live search not configured."}`;
  // Retrieval that worked but found nothing new is a success, not a failure.
  const nothingWorked = result.feedsOk === 0 && !result.searchUsed;
  if (nothingWorked) {
    await setJobStage(job.id, "failed", `Live retrieval failed. Showing cached stories. ${result.errors.slice(0, 3).join("; ")}`, {
      error: "Live retrieval failed: no feed could be read and live search is not configured. Cached stories are still shown.",
    });
    return;
  }
  await setJobStage(job.id, "completed", summary + (result.errors.length ? ` Issues: ${result.errors.slice(0, 4).join("; ")}` : ""));
}
