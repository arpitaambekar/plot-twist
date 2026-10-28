"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lightbulb, RefreshCw, ExternalLink } from "lucide-react";
import type { NewsArticle, OpportunitySignal } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { AddToOpportunity } from "@/components/shared/add-to-opportunity";
import { DemoBadge, KindLabel } from "@/components/sources/status-badge";
import { useSession } from "@/components/shell/user-context";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import { timeAgo } from "@/lib/utils";

const SENSITIVITY_TONE = { "Act now": "danger", "This quarter": "peach", Watch: "neutral" } as const;

export function OpportunitySignals({ signals, newsById, onOpen }: { signals: OpportunitySignal[]; newsById: Map<string, NewsArticle>; onOpen: (id: string) => void }) {
  const { can, integrations } = useSession();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function regenerate() {
    setBusy(true);
    try {
      const r = await api<{ items: OpportunitySignal[] }>("/api/signals", { method: "POST" });
      toast(r.items.length ? `${r.items.length} opportunity signal(s) refreshed.` : "No evidence-backed opportunities in recent news.", r.items.length ? "success" : "info");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="signals-title">
      <SectionTitle
        kicker="Opportunities Worth Watching"
        title="Where the next partnership could start"
        action={
          can("editor") &&
          integrations.ai && (
            <Button variant="secondary" size="sm" onClick={regenerate} loading={busy}>
              <RefreshCw className="h-4 w-4" /> Re-read the news
            </Button>
          )
        }
      />
      <p className="-mt-2 mb-5 max-w-3xl text-[13px] text-muted">
        AI-assisted, built only from stored news with links to the evidence. <strong className="font-medium text-ink/80">Confirmed activity</strong> means the sources report it happened; <strong className="font-medium text-ink/80">Speculative opportunity</strong> is our hypothesis.
        {signals[0] ? ` Last generated ${timeAgo(signals[0].created_at)}.` : ""}
      </p>
      {signals.length === 0 ? (
        <EmptyState
          icon={<Lightbulb className="h-6 w-6" />}
          title="No opportunity signals yet"
          body={integrations.ai ? "Signals appear after a news refresh finds India-relevant board, campaign, route or visa developments." : "Opportunity signals need OpenAI configured. Stories still appear without it."}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {signals.map((s) => {
            const evidence = s.evidence_news_ids.map((id) => newsById.get(id)).filter(Boolean) as NewsArticle[];
            return (
              <Card key={s.id} className="flex flex-col p-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge tone={s.confidence === "Confirmed activity" ? "mint" : "peach"}>{s.confidence}</Badge>
                  <Badge tone={SENSITIVITY_TONE[s.time_sensitivity]}>{s.time_sensitivity}</Badge>
                  {s.is_demo && <DemoBadge />}
                </div>
                <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-muted">{s.destination}</p>
                <h3 className="mt-1 text-[16px] font-semibold leading-snug text-ink">{s.what_happened}</h3>
                <div className="mt-3">
                  <p className="text-[12px] font-medium text-muted">Evidence</p>
                  <ul className="mt-1 space-y-1">
                    {evidence.map((n) => (
                      <li key={n.id} className="flex items-start gap-1.5 text-[13px]">
                        <button onClick={() => onOpen(n.id)} className="line-clamp-1 text-left text-ink/85 hover:text-accent hover:underline">
                          {n.title}
                        </button>
                        <a href={n.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 shrink-0 text-accent" aria-label={`Original source: ${n.source_name}`}>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </li>
                    ))}
                    {!evidence.length &&
                      s.evidence_urls.map((u) => (
                        <li key={u} className="text-[13px]">
                          <a href={u} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                            {u}
                          </a>
                        </li>
                      ))}
                  </ul>
                </div>
                <div className="mt-3 rounded-lg bg-ivory/70 p-3">
                  <div className="mb-1">
                    <KindLabel kind="interpretation" />
                  </div>
                  <p className="text-[13px] text-ink/80">{s.why_it_matters}</p>
                </div>
                <p className="mt-3 text-[13px] text-ink">
                  <span className="font-medium">Next action:</span> {s.next_action}
                </p>
                <div className="mt-auto pt-4">
                  <AddToOpportunity
                    size="sm"
                    label="Save to Opportunity Tracker"
                    defaults={{ name: `${s.destination}: ${s.what_happened.replace("[DEMO] ", "").slice(0, 70)}`, destination: s.destination, tourism_board: evidence[0]?.tourism_board ?? null, summary: `${s.what_happened}\n\nWhy it could matter (interpretation): ${s.why_it_matters}` }}
                    links={{ news_ids: s.evidence_news_ids, source_links: evidence.map((n) => ({ title: n.title, url: n.url })) }}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
