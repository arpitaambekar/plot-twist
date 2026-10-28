import "server-only";
import { db, newId, nowIso } from "@/lib/db";
import type { Destination, FeedConfig, OutboundStat, ReferenceCampaign } from "@/lib/types";
import destinations from "@/data/destinations.json";
import references from "@/data/reference-campaigns.json";
import stats from "@/data/outbound-stats.json";

/** Seed data was gathered from web-search evidence on this date; source pages still need opening and re-checking. */
export const SEED_RESEARCHED_AT = "2026-10-28T00:00:00.000Z";

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Candidate trade/news feeds. They are not assumed to work: each one shows "never checked"
 * until the first ingestion run records a real status, and admins can edit the list.
 */
const CANDIDATE_FEEDS: Omit<FeedConfig, "id">[] = (
  [
  { name: "ETTravelWorld", url: "https://travel.economictimes.indiatimes.com/rss/topstories", publisher: "ETTravelWorld (The Economic Times)", source_type: "trade" },
  { name: "Skift", url: "https://skift.com/feed/", publisher: "Skift", source_type: "trade" },
  { name: "TTG Asia", url: "https://www.ttgasia.com/feed/", publisher: "TTG Asia", source_type: "trade" },
  { name: "Simple Flying", url: "https://simpleflying.com/feed/", publisher: "Simple Flying", source_type: "news" },
  { name: "Breaking Travel News", url: "https://www.breakingtravelnews.com/rss/", publisher: "Breaking Travel News", source_type: "trade" },
] as Pick<FeedConfig, "name" | "url" | "publisher" | "source_type">[]
).map((f) => ({ ...f, enabled: true, last_status: "never" as const, last_checked_at: null, last_error: null, item_count: 0 }));

let seeding: Promise<void> | null = null;

export function ensureSeeded(): Promise<void> {
  if (!seeding) seeding = runSeed().catch((e) => {
    seeding = null;
    console.error("[plot twist] seed failed", e);
  });
  return seeding;
}

async function runSeed() {
  const store = db();

  const existingDest = await store.list("destinations", { limit: 1 });
  if (!existingDest.length) {
    const rows: Destination[] = destinations.map((d) => ({
      id: slugify(d.name),
      name: d.name,
      slug: slugify(d.name),
      kind: "country",
      country: d.name,
      continent: d.continent,
      tourism_board: d.tourism_board,
      board_website: d.board_website,
      india_page: d.india_page ?? null,
      photo_query: d.photo_query,
      photo_file: d.photo_file ?? null,
      tagline: d.tagline,
      board_verified: d.board_verified,
      created_at: nowIso(),
    }));
    await store.insertMany("destinations", rows);
  }

  const existingRefs = await store.list("reference_campaigns", { limit: 1 });
  if (!existingRefs.length) {
    const rows: ReferenceCampaign[] = (references as Omit<ReferenceCampaign, "id" | "verified_at" | "image" | "created_at" | "verification">[]).map((r) => ({
      ...r,
      id: slugify(`${r.tourism_board}-${r.name}`).slice(0, 80),
      // Seed research could only read search-result snippets, not the source pages themselves,
      // so every reference starts as "Needs Verification" until someone opens the sources.
      verification: "Needs Verification",
      verified_at: SEED_RESEARCHED_AT,
      image: null,
      created_at: nowIso(),
    }));
    await store.insertMany("reference_campaigns", rows);
  }

  const existingFeeds = await store.list("feeds", { limit: 1 });
  if (!existingFeeds.length) {
    await store.insertMany(
      "feeds",
      CANDIDATE_FEEDS.map((f) => ({ ...f, id: slugify(f.name) })),
    );
  }

  const existingStats = await store.list("outbound_stats", { limit: 1 });
  if (!existingStats.length && (stats as unknown[]).length) {
    const rows: OutboundStat[] = (stats as Omit<OutboundStat, "id" | "verified_at" | "status" | "created_by" | "created_at">[]).map((s) => ({
      ...s,
      id: newId(),
      verified_at: SEED_RESEARCHED_AT,
      status: "Needs Verification",
      created_by: "seed",
      created_at: nowIso(),
    }));
    await store.insertMany("outbound_stats", rows);
  }
}
