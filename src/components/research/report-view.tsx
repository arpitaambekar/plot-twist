"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, RefreshCw, Sparkles, Users, History, ArrowUpRight, Loader2 } from "lucide-react";
import type { ResearchJob } from "@/lib/types";
import type { ReportBundle } from "@/lib/research/service";
import { CitationProvider } from "@/components/sources/citations";
import { DemoBadge, KindLabel } from "@/components/sources/status-badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Notice, Badge } from "@/components/ui/primitives";
import { Photo } from "@/components/media/photo";
import { SaveButton } from "@/components/shared/save-button";
import { AddToOpportunity } from "@/components/shared/add-to-opportunity";
import { useSession } from "@/components/shell/user-context";
import { useToast } from "@/components/ui/toast";
import { api, download } from "@/lib/client";
import { cn, fmtDate, timeAgo } from "@/lib/utils";
import { useJob, JobStages } from "./report-progress";
import { HealthPanel } from "./health-panel";
import { Section, FactList, SingleFact, PlaceGrid, FactsGrid, SourceLibrary } from "./report-sections";

const TOC = [
  ["summary", "Summary"],
  ["snapshot", "1 · Snapshot"],
  ["indians-know", "2 · What Indians know"],
  ["beyond", "3 · Beyond the itinerary"],
  ["culture", "4 · Culture & heritage"],
  ["nature", "5 · Adventure & nature"],
  ["food", "6 · Food"],
  ["top", "7 · Top things to do"],
  ["facts", "8 · Surprising facts"],
  ["india", "9 · Why it matters"],
  ["board", "10 · Board intelligence"],
  ["campaign", "11 · Campaign opportunities"],
  ["health", "Research health"],
  ["sources", "Source library"],
] as const;

export function ReportView({ bundle, saved, job: initialJob }: { bundle: ReportBundle; saved: boolean; job: ResearchJob | null }) {
  const { report, content, claims, sources } = bundle;
  const c = content!;
  const router = useRouter();
  const toast = useToast();
  const { can } = useSession();
  const [exporting, setExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [activeId, setActiveId] = useState("summary");
  const refreshJob = useJob(report.status === "generating" ? report.job_id : null, initialJob);

  useEffect(() => {
    if (refreshJob?.status === "completed") {
      toast("Turns out, there's more to the story. New version ready.");
      router.refresh();
    }
    if (refreshJob?.status === "failed") toast(`Refresh failed: ${refreshJob.error ?? "unknown error"}. The previous version is unchanged.`, "error");
  }, [refreshJob?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const els = TOC.map(([id]) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActiveId(vis.target.id);
      },
      { rootMargin: "-80px 0px -70% 0px" },
    );
    els.forEach((e) => obs.observe(e));
    return () => obs.disconnect();
  }, []);

  async function exportDocx() {
    setExporting(true);
    try {
      await download(`/api/research/${report.id}/export?version=${bundle.version}`);
      toast("Word report downloaded.");
    } catch (e) {
      toast(`Export failed: ${(e as Error).message}`, "error");
    } finally {
      setExporting(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    try {
      await api(`/api/research/${report.id}/refresh`, { method: "POST" });
      toast("Refreshing research. The current version stays available until the new one is ready.", "info");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setRefreshing(false);
    }
  }

  const board = c.board_intel.organisation.text;
  const boardKnown = c.board_intel.organisation.claim_ids.length > 0 || !board.startsWith("Tourism authority not identified");
  const contactsHref = `/contacts?q=${encodeURIComponent(`${boardKnown ? board : report.destination_name + " tourism board"} India`)}&destination=${encodeURIComponent(report.destination_name)}`;
  const gallery = c.gallery.filter((g) => g.url !== c.snapshot.hero_image?.url);

  return (
    <CitationProvider claims={claims} sources={sources} sourceOrder={bundle.source_ids}>
      <article>
        {/* Editorial hero: huge name, asymmetric photography */}
        <header className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
          <div className="flex flex-col justify-between pt-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="eyebrow">Destination report · v{bundle.version}</p>
                {report.is_demo && <DemoBadge />}
                {report.status === "partial" && <Badge tone="peach">Partial research</Badge>}
              </div>
              <h1 className={cn("mt-4 font-semibold tracking-[-0.05em] text-ink [overflow-wrap:normal]", nameSize(report.destination_name), "leading-[0.95]")}>
                {report.destination_name}
                <span className="text-accent">.</span>
              </h1>
              {c.snapshot.location.text && <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted">{c.snapshot.location.text}</p>}
              <div className="mt-5 flex flex-wrap gap-1.5 text-[12px]">
                <Badge>{report.options.traveller_type}</Badge>
                <Badge>{report.options.travel_period}</Badge>
                <Badge>{report.options.depth === "quick" ? "Quick overview" : "Comprehensive"}</Badge>
              </div>
              <p className="mt-4 text-[12px] text-muted">
                Generated {fmtDate(report.created_at)} · Updated {fmtDate(report.updated_at)} · {bundle.health?.source_count ?? sources.length} cited sources
              </p>
            </div>
            <div className="mt-7 space-y-3">
              <div className="flex flex-wrap gap-2">
                <Link href={`/studio?report=${report.id}&version=${bundle.version}`} className={buttonClasses("primary", "md")}>
                  <Sparkles className="h-4 w-4" /> Turn This Into Campaign Ideas
                </Link>
                <Button variant="secondary" onClick={exportDocx} loading={exporting}>
                  {!exporting && <Download className="h-4 w-4" />} {exporting ? "Preparing Word file…" : "Download Word Report"}
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <SaveButton type="report" id={report.id} label={`${report.destination_name} report`} initial={saved} variant="button" className="h-8 px-3 text-[13px]" />
                <Link href={contactsHref} className={buttonClasses("secondary", "sm")}>
                  <Users className="h-3.5 w-3.5" /> Find Tourism Board Contacts
                </Link>
                {can("editor") && (
                  <Button variant="secondary" size="sm" onClick={refresh} loading={refreshing} disabled={report.status === "generating"}>
                    {!refreshing && <RefreshCw className="h-3.5 w-3.5" />} Refresh Research
                  </Button>
                )}
                <AddToOpportunity
                  size="sm"
                  defaults={{
                    name: `${report.destination_name} partnership`,
                    destination: report.destination_name,
                    tourism_board: boardKnown ? board : null,
                    summary: c.executive_summary.slice(0, 400),
                  }}
                  links={{ report_id: report.id }}
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-6 grid-rows-[auto_auto] gap-3">
            <Photo image={c.snapshot.hero_image} label={report.destination_name} eager className={cn("col-span-6 aspect-[4/3] rounded-[20px] md:aspect-[16/11]", gallery.length >= 2 && "md:col-span-4 md:row-span-2 md:aspect-auto md:h-full")} />
            {gallery.slice(0, 2).map((g, i) => (
              <Photo key={g.url} image={g} label={g.alt} className={cn("hidden aspect-[4/5] rounded-[16px] md:col-span-2 md:block", i === 1 && "md:mt-8")} />
            ))}
          </div>
        </header>

        {/* Status notices */}
        <div className="mt-8 space-y-3">
          {report.status === "generating" && (
            <Notice tone="blue" title="Refreshing research…">
              <div className="mt-2">
                <JobStages job={refreshJob} />
              </div>
            </Notice>
          )}
          {!bundle.is_latest && (
            <Notice
              tone="peach"
              title={`You are viewing version ${bundle.version}`}
              action={
                <Link href={`/research/${report.id}`} className="text-sm font-medium text-accent hover:underline">
                  View latest (v{report.version})
                </Link>
              }
            >
              Campaigns linked to this version keep pointing at it. A newer version exists.
            </Notice>
          )}
          {report.is_demo && (
            <Notice tone="danger" title="Demo data">
              This report was generated from offline demo fixtures to test the workflow. It is not travel information.
            </Notice>
          )}
          {report.partial_notes.length > 0 && (
            <Notice tone="peach" title="Partial research: some sections have gaps">
              <ul className="mt-1 list-disc pl-4">
                {report.partial_notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </Notice>
          )}
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_280px]">
          {/* Sticky table of contents */}
          <nav className="hidden lg:block" aria-label="Report contents">
            <div className="sticky top-24 space-y-0.5">
              <p className="eyebrow mb-3">Contents</p>
              {TOC.map(([id, label]) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className={cn("block rounded-md px-2 py-1 text-[13px] transition-colors", activeId === id ? "bg-soft-blue font-medium text-accent" : "text-ink/65 hover:text-ink")}
                >
                  {label}
                </a>
              ))}
              <div className="pt-4">
                <button onClick={() => setShowVersions((s) => !s)} className="flex items-center gap-1.5 px-2 text-[13px] text-ink/65 hover:text-ink" aria-expanded={showVersions}>
                  <History className="h-3.5 w-3.5" /> Version history ({bundle.versions.length})
                </button>
                {showVersions && <VersionList bundle={bundle} />}
              </div>
            </div>
          </nav>

          <div className="min-w-0 max-w-[780px] space-y-16">
            <section id="summary" className="scroll-mt-24">
              <p className="eyebrow mb-3">Executive summary</p>
              <p className="text-[19px] leading-[1.6] text-ink">{c.executive_summary}</p>
              <p className="mt-3 text-[12px] text-muted">Summary written from verified findings only. Numbers in blue open the evidence.</p>
              <div className="mt-6 xl:hidden">
                <HealthPanel bundle={bundle} compact />
              </div>
            </section>

            <Section id="snapshot" n={1} title="Destination snapshot" kind="fact">
              <SingleFact item={c.snapshot.overview} large />
              <div className="grid gap-6 md:grid-cols-2">
                <FactList title="Why travellers visit" items={c.snapshot.why_visit} />
                <FactList title="Main experiences" items={c.snapshot.experiences} />
                <FactList title="Seasons" items={c.snapshot.seasons} />
                <FactList title="Travel considerations" items={c.snapshot.considerations} />
              </div>
              {c.snapshot.trip_duration.text && (
                <div className="rounded-xl bg-soft-mint/60 p-4">
                  <p className="eyebrow mb-1">Typical trip</p>
                  <SingleFact item={c.snapshot.trip_duration} />
                </div>
              )}
              <div className="rounded-xl border border-line p-5">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-semibold text-ink">Entry requirements for Indian passport holders</h4>
                  <Badge tone="peach">Re-check monthly</Badge>
                </div>
                <FactList items={c.snapshot.entry_requirements} empty="No official source supported entry requirements in this run. Check the destination's official immigration website." />
              </div>
              <FactList title="Connectivity from India" items={c.snapshot.connectivity} empty="No verified India connectivity information was found." />
            </Section>

            <Section id="indians-know" n={2} title="What Indians already know" kind="fact">
              <Notice tone={c.indians_know.documented.length ? "blue" : "peach"}>{c.indians_know.awareness_note}</Notice>
              <FactList title="Documented India-specific awareness" items={c.indians_know.documented} empty="India-specific awareness not established." />
              <FactList title="Internationally famous (not evidence of Indian awareness)" items={c.indians_know.general_popularity} />
              <FactList title="Film and entertainment connections" items={c.indians_know.entertainment_links} />
            </Section>

            <Section id="beyond" n={3} title="Beyond the usual itinerary" kind="fact" intro="Under-promoted places and experiences, less common in mainstream itineraries, according to the sources retrieved.">
              <PlaceGrid places={c.beyond_itinerary} detailed destination={report.destination_name} />
            </Section>

            <Section id="culture" n={4} title="Culture and heritage" kind="fact">
              {c.culture.length ? c.culture.map((g) => <FactList key={g.heading} title={g.heading} items={g.items} />) : <FactList items={[]} empty="No verified cultural findings in this run." />}
            </Section>

            <Section id="nature" n={5} title="Adventure and nature" kind="fact">
              {c.nature.length ? (
                <div className="grid gap-6 md:grid-cols-2">
                  {c.nature.map((g) => (
                    <FactList key={g.heading} title={g.heading} items={g.items} />
                  ))}
                </div>
              ) : (
                <FactList items={[]} empty="No verified nature findings in this run." />
              )}
              <p className="text-[12px] text-muted">Only visitor-accessible experiences are listed. Confirm permits, seasonal closures and safety advisories with official authorities.</p>
            </Section>

            <Section id="food" n={6} title="Food and culinary experiences" kind="fact">
              <div className="grid gap-6 md:grid-cols-2">
                <FactList title="Dishes and specialities" items={c.food.dishes} />
                <FactList title="Culinary experiences" items={c.food.experiences} />
              </div>
              <div className="rounded-xl bg-soft-mint/60 p-4">
                <p className="eyebrow mb-2">For vegetarian travellers</p>
                <FactList items={c.food.vegetarian} empty="Vegetarian availability was not established by the sources retrieved." />
              </div>
              <FactList title="Notes" items={c.food.notes} />
            </Section>

            <Section id="top" n={7} title="Top destinations and things to do" kind="fact">
              <PlaceGrid places={c.top_things} destination={report.destination_name} />
            </Section>

            <Section id="facts" n={8} title="Eight surprising facts" kind="fact" intro="Only facts verified by a primary source or corroborated by independent sources are included.">
              <FactsGrid facts={c.surprising_facts} />
              {c.facts_gap_note && <Notice tone="peach">{c.facts_gap_note}</Notice>}
            </Section>

            <Section id="india" n={9} title="Why it matters to Indian travellers" kind="fact">
              <FactList title="Research evidence" items={c.india_relevance.evidence} empty="No published Indian arrival or demand data was found in this run." />
              <FactList title="Potential barriers" items={c.india_relevance.barriers} />
              {(c.india_relevance.segments.length > 0 || c.india_relevance.hypotheses.length > 0) && (
                <div className="rounded-xl border border-accent/15 bg-soft-blue/50 p-5">
                  <KindLabel kind="interpretation" />
                  {c.india_relevance.segments.length > 0 && (
                    <>
                      <h4 className="mt-3 text-[14px] font-semibold text-ink">Relevant audience segments</h4>
                      <ul className="mt-1.5 flex flex-wrap gap-1.5">
                        {c.india_relevance.segments.map((s) => (
                          <li key={s}>
                            <Badge tone="blue">{s}</Badge>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {c.india_relevance.hypotheses.length > 0 && (
                    <>
                      <h4 className="mt-4 text-[14px] font-semibold text-ink">Strategy hypotheses</h4>
                      <ul className="prose-plot mt-1.5 text-[14px] text-ink/85">
                        {c.india_relevance.hypotheses.map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </Section>

            <Section id="board" n={10} title="Tourism board marketing intelligence" kind="fact">
              <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-line p-5">
                <div>
                  <p className="eyebrow mb-1">Organisation</p>
                  <SingleFact item={c.board_intel.organisation} />
                  {c.board_intel.organisation.claim_ids.length === 0 && <p className="mt-1 text-[12px] text-peach-ink">From the internal directory; not verified in this run.</p>}
                </div>
                {c.board_intel.website && (
                  <a href={c.board_intel.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
                    Official website <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <FactList title="Current positioning" items={c.board_intel.positioning} />
                <FactList title="Recent campaigns" items={c.board_intel.recent_campaigns} />
                <FactList title="India-market activity" items={c.board_intel.india_activity} empty="No India-specific marketing activity was found in this run." />
                <FactList title="Published priorities" items={c.board_intel.priorities} />
                <FactList title="Partnerships (OTAs, airlines)" items={c.board_intel.partnerships} />
              </div>
              <p className="text-[12px] text-muted">{c.board_intel.note}</p>
            </Section>

            <Section id="campaign" n={11} title="Campaign opportunity summary" kind="interpretation" intro="Strategic recommendations from plot twist. analysis. Not tourism-board statements or confirmed openings.">
              <CampaignSummary c={c} reportId={report.id} version={bundle.version} />
            </Section>

            <section id="health" className="scroll-mt-24">
              <h2 className="mb-5 text-[24px] font-semibold tracking-[-0.02em] text-ink">Research health</h2>
              <HealthPanel bundle={bundle} />
            </section>

            <section id="sources" className="scroll-mt-24">
              <h2 className="mb-2 text-[24px] font-semibold tracking-[-0.02em] text-ink">Source library</h2>
              <p className="mb-5 text-[13px] text-muted">
                {sources.length} sources retrieved · research generated {fmtDate(report.created_at)} · last updated {timeAgo(report.updated_at)}
              </p>
              <SourceLibrary sources={sources} claims={claims} order={bundle.source_ids} />
            </section>
          </div>

          <aside className="hidden xl:block">
            <div className="sticky top-24">
              <HealthPanel bundle={bundle} compact />
            </div>
          </aside>
        </div>
      </article>
    </CitationProvider>
  );
}

function nameSize(name: string) {
  const longest = Math.max(...name.split(/\s+/).map((w) => w.length));
  if (longest <= 7 && name.length <= 14) return "text-[56px] md:text-[84px] xl:text-[96px]";
  if (longest <= 10) return "text-[48px] md:text-[68px] xl:text-[78px]";
  if (longest <= 13) return "text-[40px] md:text-[54px] xl:text-[62px]";
  return "text-[34px] md:text-[44px] xl:text-[50px] [overflow-wrap:anywhere]";
}

function VersionList({ bundle }: { bundle: ReportBundle }) {
  return (
    <ul className="mt-2 space-y-2 border-l border-line pl-3">
      {bundle.versions.map((v) => (
        <li key={v.version}>
          <Link href={`/research/${bundle.report.id}?version=${v.version}`} className={cn("block text-[12px]", v.version === bundle.version ? "font-semibold text-accent" : "text-ink/75 hover:text-ink")}>
            v{v.version} · {fmtDate(v.created_at)}
            {v.health && <span className="text-muted"> · {v.health.evidence_pct}% evidenced</span>}
          </Link>
          <p className="text-[11px] leading-snug text-muted">{v.change_summary}</p>
        </li>
      ))}
      {bundle.report.status === "generating" && (
        <li className="flex items-center gap-1.5 text-[12px] text-accent">
          <Loader2 className="h-3 w-3 animate-spin" /> New version in progress
        </li>
      )}
    </ul>
  );
}

function CampaignSummary({ c, reportId, version }: { c: NonNullable<ReportBundle["content"]>; reportId: string; version: number }) {
  const cs = c.campaign_summary;
  if (!cs.opportunities.length && !cs.territories.length)
    return <p className="text-sm text-muted">Strategic synthesis was not available for this version. Refresh the research or go straight to Campaign Studio.</p>;
  return (
    <div className="space-y-8">
      <div>
        <h4 className="mb-3 font-semibold text-ink">Three strongest opportunities</h4>
        <div className="grid gap-3 md:grid-cols-3">
          {cs.opportunities.map((o, i) => (
            <div key={i} className="rounded-xl border border-accent/15 bg-soft-blue/40 p-4">
              <p className="text-[12px] font-semibold text-accent">0{i + 1}</p>
              <p className="mt-1 font-semibold leading-snug text-ink">{o.title}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-ink/75">{o.rationale}</p>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-3 flex items-center gap-2">
          <h4 className="font-semibold text-ink">Creative territories</h4>
          <KindLabel kind="hypothesis" />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {cs.territories.map((t, i) => (
            <div key={i} className="rounded-xl border border-peach-ink/15 bg-soft-peach/50 p-4">
              <p className="font-semibold text-ink">{t.name}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-ink/75">{t.description}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <SimpleList title="Target segments" items={cs.segments} />
        <SimpleList title="Potential Scapia touchpoints" items={cs.scapia_touchpoints} note="Potential components, not claims about existing features." />
        <SimpleList title="Practical constraints" items={cs.constraints} />
      </div>
      {cs.next_step && (
        <div className="flex flex-col gap-3 rounded-xl bg-ink p-5 text-white md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[12px] uppercase tracking-[0.14em] text-white/60">Recommended next step</p>
            <p className="mt-1 text-[15px]">{cs.next_step}</p>
          </div>
          <Link href={`/studio?report=${reportId}&version=${version}`} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-ink hover:bg-soft-blue">
            <Sparkles className="h-4 w-4" /> Generate campaign ideas
          </Link>
        </div>
      )}
    </div>
  );
}

function SimpleList({ title, items, note }: { title: string; items: string[]; note?: string }) {
  if (!items.length) return null;
  return (
    <div>
      <h4 className="mb-2 text-[14px] font-semibold text-ink">{title}</h4>
      <ul className="prose-plot text-[14px] text-ink/85">
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      {note && <p className="mt-1 text-[11px] text-muted">{note}</p>}
    </div>
  );
}
