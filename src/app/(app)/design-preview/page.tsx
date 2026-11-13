/* eslint-disable @next/next/no-img-element */
/**
 * DESIGN PREVIEW ONLY. Not linked from the app; delete once the redesign is approved.
 * Renders the proposed Home redesign with real data, plus examples of a card, a filter bar
 * and a table so the working surfaces can be judged. Nothing here is wired to actions.
 */
import localFont from "next/font/local";
import { ArrowRight, Bookmark, ChevronLeft, ChevronRight, ExternalLink, LayoutGrid, List, RefreshCw, Search, SlidersHorizontal, Plus, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { loadReadinessMap } from "@/lib/opportunities/load";
import { CATEGORY_TABS, DEFAULT_FILTERS, applyFilters, featuredScore, sortByDate } from "@/components/home/shared";
import { ReadinessBar } from "@/components/opportunities/readiness-badge";
import { ClaimStatusBadge, ContactStatusBadge } from "@/components/sources/status-badge";
import type { ImageRef, NewsArticle } from "@/lib/types";
import { cn, fmtDate, timeAgo } from "@/lib/utils";
import "./preview.css";

const fraunces = localFont({ src: "./fonts/fraunces.woff2", variable: "--font-fraunces", weight: "100 900", display: "swap" });

export const metadata = { title: "Design preview", robots: { index: false } };
export const dynamic = "force-dynamic";

function Img({ image, label, className }: { image: ImageRef | null | undefined; label: string; className?: string }) {
  if (!image) {
    return (
      <div className={cn("dp-fallback relative flex items-end", className)} role="img" aria-label={`${label} (no licensed photo available)`}>
        <div className="dp-contours absolute inset-0" />
        <span className="dp-display-sm relative p-4 text-[17px] text-white/70">{label}</span>
      </div>
    );
  }
  return <img src={image.url} alt={image.alt || label} loading="lazy" referrerPolicy="no-referrer" className={cn("object-cover", className)} />;
}

function Relevance({ level }: { level: NewsArticle["india_relevance"] }) {
  const map = { High: "bg-[#2f6b47]", Medium: "bg-[#4169d7]", Low: "bg-[#c4c9ce]" };
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--dp-mist)]">
      <span className={cn("h-1.5 w-1.5 rounded-full", map[level])} aria-hidden /> India: {level}
    </span>
  );
}

export default async function DesignPreview() {
  const store = db();
  const settings = await getSettings();
  const [newsAll, stats, signals, opps, contacts, refs] = await Promise.all([
    store.list("news_articles", { orderBy: { column: "published_at" }, limit: 600 }),
    store.list("outbound_stats", { orderBy: { column: "created_at" } }),
    store.list("opportunity_signals", { orderBy: { column: "created_at" } }),
    store.list("opportunities", { orderBy: { column: "updated_at" } }),
    store.list("contacts", { orderBy: { column: "updated_at" }, limit: 4 }),
    store.list("reference_campaigns", { limit: 2 }),
  ]);
  const news = env.demoFixtures ? newsAll : newsAll.filter((n) => !n.is_demo);
  const sorted = sortByDate(news);
  const filtered = applyFilters(sorted, DEFAULT_FILTERS, new Set());
  const featured = [...filtered].sort((a, b) => featuredScore(b) - featuredScore(a)).slice(0, 5);
  const hero = featured[0];
  const grid = filtered.filter((n) => !featured.some((f) => f.id === n.id)).slice(0, 6);
  const week = news.filter((n) => n.india_relevance !== "Low").slice(0, 3);
  const readiness = await loadReadinessMap(opps);
  const counts: Record<string, number> = { All: filtered.length };
  for (const n of filtered) counts[n.category] = (counts[n.category] ?? 0) + 1;

  return (
    <div className={cn("dp", fraunces.variable)}>
      <p className="mb-6 rounded-xl border border-dashed border-[var(--dp-line)] bg-white px-4 py-2.5 text-[13px] text-[var(--dp-mist)]">
        Design preview of the redesigned Home page, using your real data. Buttons here are not wired up. This page isn&apos;t linked from the app and will be deleted after approval.
      </p>

      {/* ───────────────── HOME HERO: featured story as full-bleed photography ───────────────── */}
      <section className="relative isolate flex min-h-[640px] flex-col overflow-hidden rounded-[28px] bg-[var(--dp-fjord)] text-white" aria-label="The Latest Plot">
        <Img image={hero?.image} label="" className="absolute inset-0 -z-20 h-full w-full" />
        <div className="dp-scrim absolute inset-0 -z-10" />

        <div className="flex items-start justify-between gap-4 p-6 md:p-9">
          <span className="dp-glass rounded-full px-3.5 py-1.5 text-[13px] font-medium">The Latest Plot</span>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="dp-glass hidden rounded-full px-3.5 py-1.5 text-[12px] sm:inline">Last updated {timeAgo(settings.last_news_refresh_at)}</span>
            <span className="dp-glass inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </span>
          </div>
        </div>

        <div className="px-6 pt-6 md:px-9 md:pt-10">
          <h1 className="dp-display max-w-[12ch] text-[48px] leading-[0.98] sm:text-[64px] lg:text-[80px]">What&apos;s happening in travel?</h1>
          <p className="mt-4 max-w-md text-[17px] leading-relaxed text-white/85">The stories, shifts and opportunities worth knowing.</p>
        </div>

        <div className="mt-auto flex flex-col gap-4 px-4 pb-14 pt-10 md:flex-row md:items-end md:justify-between md:px-9">
        {hero && (
            <article className="dp-glass-strong w-full rounded-[20px] p-5 md:max-w-[560px] md:p-6">
              <p className="text-[12px] text-white/75">
                <span className="font-semibold text-white">Featured</span> {fmtDate(hero.published_at)} · {hero.category}
                {hero.destinations[0] ? ` · ${hero.destinations[0]}` : ""}
              </p>
              <h2 className="dp-display-sm mt-2 line-clamp-3 text-[24px] leading-[1.15] md:text-[28px]">{hero.title}</h2>
              <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-white/80">{hero.summary}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <span className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-sm font-medium text-[var(--dp-ink)]">
                  Read the story <ArrowRight className="h-4 w-4" />
                </span>
                <span className="dp-glass inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium">
                  <Bookmark className="h-4 w-4" /> Save
                </span>
                <span className="ml-auto text-[12px] text-white/70">Source: {hero.source_name}</span>
              </div>
            </article>
        )}
        <div className="hidden items-center gap-2 md:flex">
          <span className="text-[12px] tabular-nums text-white/75">01 / {String(featured.length).padStart(2, "0")}</span>
          <span className="dp-glass rounded-full p-2" aria-hidden>
            <ChevronLeft className="h-4 w-4" />
          </span>
          <span className="dp-glass rounded-full p-2" aria-hidden>
            <ChevronRight className="h-4 w-4" />
          </span>
        </div>
        </div>
      </section>

      {/* ───────────────── FILTER BAR: floats over the hero edge, stays functional ───────────────── */}
      <div className="relative z-10 mx-3 -mt-8 rounded-2xl border border-[var(--dp-line)] bg-white p-2 shadow-[0_18px_50px_-20px_rgba(14,42,51,0.35)] md:mx-8">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" role="tablist" aria-label="Category">
            {CATEGORY_TABS.map((t, i) => (
              <span
                key={t.key}
                className={cn("whitespace-nowrap rounded-full px-3.5 py-2 text-[13px]", i === 0 ? "bg-[var(--dp-ink)] font-medium text-white" : "text-[var(--dp-ink)]/75")}
              >
                {t.label} <span className={i === 0 ? "text-white/60" : "text-[var(--dp-mist)]"}>{counts[t.key] ?? 0}</span>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--dp-mist)]" />
              <span className="flex h-9 w-44 items-center rounded-full bg-[var(--dp-paper)] pl-8 text-[13px] text-[var(--dp-mist)]">Filter stories</span>
            </span>
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--dp-line)] px-3.5 text-[13px] font-medium">
              <SlidersHorizontal className="h-4 w-4" /> Filters
            </span>
            <span className="inline-flex rounded-full bg-[var(--dp-paper)] p-0.5">
              <span className="rounded-full bg-white p-1.5 shadow-sm">
                <LayoutGrid className="h-4 w-4" />
              </span>
              <span className="p-1.5 text-[var(--dp-mist)]">
                <List className="h-4 w-4" />
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* ───────────────── LATEST UPDATES: photo-first cards, no boxes ───────────────── */}
      <div className="mt-12 grid gap-12 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section aria-labelledby="dp-latest">
          <p className="dp-label">Latest Travel Updates</p>
          <h2 id="dp-latest" className="dp-display mt-1 text-[36px] leading-tight">
            {filtered.length} stories <span className="font-sans text-[15px] font-normal tracking-normal text-[var(--dp-mist)]">in the last 30 days</span>
          </h2>
          <div className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {grid.map((n) => (
              <article key={n.id} className="dp-lift group">
                <div className="relative aspect-[4/3] overflow-hidden rounded-[20px]">
                  <Img image={n.image} label={n.destinations[0] ?? n.category} className="h-full w-full" />
                  <div className="dp-card-scrim absolute inset-0" />
                  <span className="dp-glass absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-medium">{n.category}</span>
                  <span className="dp-glass absolute right-3 top-3 rounded-full p-2">
                    <Bookmark className="h-3.5 w-3.5" />
                  </span>
                  {n.image?.is_destination_photo && <span className="dp-glass absolute bottom-3 left-3 rounded-full px-2.5 py-1 text-[10px]">Destination photo</span>}
                </div>
                <h3 className="dp-display-sm mt-4 line-clamp-3 text-[21px] leading-[1.18]">{n.title}</h3>
                <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-[var(--dp-mist)]">{n.summary}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--dp-mist)]">
                  <span>
                    <span className="font-medium text-[var(--dp-ink)]/80">{n.source_name}</span> · {fmtDate(n.published_at)}
                  </span>
                  <Relevance level={n.india_relevance} />
                  <span className="inline-flex items-center gap-1 font-medium text-[var(--dp-blue)]">
                    Source <ExternalLink className="h-3 w-3" />
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Digest: an open column with a hairline, not another white box */}
        <aside className="border-l border-[var(--dp-line)] pl-6" aria-labelledby="dp-week">
          <h2 id="dp-week" className="dp-display text-[28px] leading-tight">This Week in Travel</h2>
          <p className="mt-1 text-[13px] text-[var(--dp-mist)]">The last seven days at a glance.</p>
          <p className="mt-7 text-[13px] font-semibold text-[var(--dp-ink)]/60">Top stories</p>
          <ul className="mt-2 space-y-3">
            {week.map((n) => (
              <li key={n.id} className="flex gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                  <Img image={n.image} label="" className="h-full w-full" />
                </div>
                <span className="line-clamp-3 text-[14px] leading-snug">{n.title}</span>
              </li>
            ))}
          </ul>
          <p className="mt-7 text-[13px] font-semibold text-[var(--dp-ink)]/60">Opportunities</p>
          <ul className="mt-2 space-y-3 text-[14px] leading-snug">
            {signals.slice(0, 2).map((s) => (
              <li key={s.id}>
                <span className="font-medium">{s.destination}:</span> <span className="text-[var(--dp-ink)]/80">{s.what_happened}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {/* ───────────────── OPPORTUNITIES: working cards, quieter ───────────────── */}
      <section className="mt-16" aria-labelledby="dp-opps">
        <p className="dp-label">Opportunities Worth Watching</p>
        <h2 id="dp-opps" className="dp-display mt-1 text-[36px] leading-tight">Where the next partnership could start</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {signals.slice(0, 3).map((s) => (
            <article key={s.id} className="flex flex-col rounded-[14px] border border-[var(--dp-line)] bg-white p-5">
              <div className="flex flex-wrap gap-1.5 text-[11px] font-medium">
                <span className={cn("rounded-full px-2.5 py-0.5", s.confidence === "Confirmed activity" ? "bg-[#eaf4ee] text-[#2f6b47]" : "bg-[#fff0e6] text-[#9a4a17]")}>{s.confidence}</span>
                <span className="rounded-full bg-[var(--dp-paper)] px-2.5 py-0.5 text-[var(--dp-ink)]/70">{s.time_sensitivity}</span>
              </div>
              <h3 className="dp-display-sm mt-3 text-[22px] leading-tight">{s.destination}</h3>
              <p className="mt-1.5 line-clamp-3 text-[14px] leading-relaxed text-[var(--dp-ink)]/80">{s.what_happened}</p>
              <p className="mt-3 border-t border-[var(--dp-line)] pt-3 text-[13px] leading-relaxed">
                <span className="font-medium">Next action:</span> {s.next_action}
              </p>
              <span className="mt-4 inline-flex h-9 w-fit items-center gap-1.5 rounded-full border border-[var(--dp-line)] px-3.5 text-[13px] font-medium">Save to Opportunity Tracker</span>
            </article>
          ))}
        </div>
      </section>

      {/* ───────────────── OUTBOUND WATCH: data surface, dense and clean ───────────────── */}
      <section className="mt-16" aria-labelledby="dp-stats">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="dp-label">India Outbound Watch</p>
            <h2 id="dp-stats" className="dp-display mt-1 text-[36px] leading-tight">The numbers behind the shift</h2>
          </div>
          <div className="flex gap-2">
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--dp-line)] bg-white px-3.5 text-[13px] font-medium">
              <ShieldCheck className="h-4 w-4" /> Check all sources
            </span>
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--dp-line)] bg-white px-3.5 text-[13px] font-medium">
              <Plus className="h-4 w-4" /> Add a statistic
            </span>
          </div>
        </div>
        <div className="mt-6 grid gap-px overflow-hidden rounded-[14px] border border-[var(--dp-line)] bg-[var(--dp-line)] sm:grid-cols-2 lg:grid-cols-4">
          {stats.slice(0, 4).map((s) => (
            <div key={s.id} className="bg-white p-5">
              <ClaimStatusBadge status={s.status} />
              <p className="mt-3 text-[12px] text-[var(--dp-mist)]">
                {s.destination}
                <br />
                <span className="font-medium text-[var(--dp-ink)]">{s.metric}</span>
              </p>
              <p className="dp-display mt-3 text-[34px] leading-none tabular-nums">{new Intl.NumberFormat("en-IN").format(s.value)}</p>
              <p className="mt-1.5 text-[12px] text-[var(--dp-mist)]">
                {s.unit}, {s.reporting_period}
                {s.yoy_change_pct !== null && <span className="ml-1 font-medium text-[#2f6b47]">+{s.yoy_change_pct}%</span>}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ═════════════════ WORKING SURFACES: examples for judging density ═════════════════ */}
      <div className="mt-20 border-t border-[var(--dp-line)] pt-10">
        <p className="text-[13px] text-[var(--dp-mist)]">Working-surface examples. These stay dense and easy to scan; only type, spacing and colour change.</p>

        {/* Example: a non-Home page header (Contacts) using the cinematic treatment */}
        <section className="relative isolate mt-6 overflow-hidden rounded-[28px] text-white" aria-label="Page header example">
          <Img image={null} label="" className="absolute inset-0 -z-20 h-full w-full" />
          <div className="px-6 py-10 md:px-9 md:py-14">
            <span className="dp-glass rounded-full px-3.5 py-1.5 text-[13px] font-medium">The People Behind the Plot</span>
            <h2 className="dp-display mt-5 text-[44px] leading-[1] md:text-[56px]">Find the right people.</h2>
            <p className="mt-3 text-[16px] text-white/85">Every great partnership starts with a conversation.</p>
            <div className="mt-6 flex max-w-2xl items-center gap-2 rounded-full bg-white p-1.5 pl-5 text-[var(--dp-ink)]">
              <Search className="h-4 w-4 text-[var(--dp-mist)]" />
              <span className="flex-1 text-[14px] text-[var(--dp-mist)]">Search a destination, tourism board or representative...</span>
              <span className="rounded-full bg-[var(--dp-blue)] px-5 py-2.5 text-[14px] font-medium text-white">Find Contacts</span>
            </div>
          </div>
        </section>

        {/* Example: filter bar on a working page (Contacts directory) */}
        <div className="mt-8 rounded-[14px] border border-[var(--dp-line)] bg-white p-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
            {["Destination", "Tourism board", "Role", "India office", "Representation agency", "Verification", "Last verified"].map((f) => (
              <label key={f} className="block">
                <span className="mb-1 block text-[12px] font-medium text-[var(--dp-mist)]">{f}</span>
                <span className="flex h-9 items-center rounded-lg bg-[var(--dp-paper)] px-3 text-[13px]">All</span>
              </label>
            ))}
          </div>
        </div>

        {/* Example: contact card */}
        <div className="mt-4 grid items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
          {contacts.slice(0, 3).map((c) => (
            <article key={c.id} className="rounded-[14px] border border-[var(--dp-line)] bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="dp-display-sm text-[20px] leading-tight">{c.full_name}</h3>
                  <p className="mt-0.5 text-[13px]">{c.job_title}</p>
                  <p className="text-[12px] text-[var(--dp-mist)]">{c.organisation}</p>
                </div>
                <ContactStatusBadge status={c.status} />
              </div>
              <p className="mt-3 text-[12px] text-[var(--dp-mist)]">Checked {fmtDate(c.last_verified_at)}</p>
            </article>
          ))}
          {refs[0] && (
            <article className="dp-lift overflow-hidden rounded-[20px] bg-white">
              <div className="relative aspect-[16/10]">
                <Img image={refs[0].image} label={refs[0].destination} className="h-full w-full" />
                <div className="dp-card-scrim absolute inset-0" />
                <span className="absolute left-3 top-3">
                  <ClaimStatusBadge status={refs[0].verification} />
                </span>
              </div>
              <div className="p-5">
                <p className="text-[12px] text-[var(--dp-mist)]">
                  {refs[0].tourism_board} · {refs[0].launch_date}
                </p>
                <h3 className="dp-display-sm mt-1 text-[20px] leading-tight">{refs[0].name}</h3>
              </div>
            </article>
          )}
        </div>

        {/* Example: Opportunity Tracker table */}
        <div className="mt-8">
          <p className="dp-label">What&apos;s Next?</p>
          <h2 className="dp-display mt-1 text-[36px] leading-tight">Keep the good ideas moving.</h2>
          <div className="mt-5 overflow-x-auto rounded-[14px] border border-[var(--dp-line)] bg-white">
            <table className="w-full min-w-[820px] text-left text-[13px]">
              <thead className="bg-[var(--dp-paper)] text-[12px] text-[var(--dp-mist)]">
                <tr>
                  {["Opportunity", "Stage", "Priority", "Pitch readiness", "Next action", "Owner", "Updated"].map((h) => (
                    <th key={h} className="px-4 py-2.5 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(opps.length ? opps : []).slice(0, 6).map((o) => {
                  const r = readiness[o.id];
                  return (
                    <tr key={o.id} className="border-t border-[var(--dp-line)] hover:bg-[#f4f6f7]">
                      <td className="px-4 py-3">
                        <p className="font-medium">{o.name}</p>
                        <p className="text-[12px] text-[var(--dp-mist)]">{o.destination}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full border border-[var(--dp-line)] px-2.5 py-1 text-[12px]">{o.stage}</span>
                      </td>
                      <td className="px-4 py-3">{o.priority}</td>
                      <td className="px-4 py-3">
                        {r && (
                          <>
                            <span className="text-[12px] font-medium text-[var(--dp-blue)]">{r.status}</span>
                            <ReadinessBar pct={r.pct} className="mt-1 w-40" />
                            <span className="text-[11px] text-[var(--dp-mist)]">
                              {r.completed}/{r.total} criteria
                            </span>
                          </>
                        )}
                      </td>
                      <td className="max-w-[260px] px-4 py-3 text-[var(--dp-ink)]/80">{o.next_action ?? (r?.next ? `Suggested: ${r.next.action?.label ?? r.next.label}` : "")}</td>
                      <td className="px-4 py-3">{o.owner}</td>
                      <td className="px-4 py-3 text-[var(--dp-mist)]">{timeAgo(o.updated_at)}</td>
                    </tr>
                  );
                })}
                {!opps.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[var(--dp-mist)]">
                      No opportunities yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
