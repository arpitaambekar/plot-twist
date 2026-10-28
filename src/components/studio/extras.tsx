"use client";
import { Smartphone, Clapperboard, Film, Zap, MonitorSmartphone } from "lucide-react";
import type { CampaignExtras } from "@/lib/types";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { KindLabel } from "@/components/sources/status-badge";

function Row({ k, v }: { k: string; v: string }) {
  if (!v) return null;
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 py-1.5 text-[13px]">
      <dt className="text-muted">{k}</dt>
      <dd className="whitespace-pre-line text-ink/90">{v}</dd>
    </div>
  );
}

export function ExtrasPanel({ extras, kind }: { extras: CampaignExtras | null; kind: "in_app" | "short_form" | "long_form" | "hero_ideas" }) {
  if (!extras) return <EmptyState title="Not generated yet" body="These outputs are created after the ten main concepts. If generation finished without them, use Retry above." />;

  if (kind === "in_app")
    return (
      <div className="space-y-4">
        <Header icon={Smartphone} title={`${extras.in_app.length} in-app marketing ideas`} note="Placements are potential Scapia surfaces, not confirmed product features." />
        <div className="grid gap-4 md:grid-cols-2">
          {extras.in_app.map((x, i) => (
            <Card key={i} className="p-5">
              <div className="mb-2 flex items-center gap-2">
                <Badge tone="blue">{x.placement}</Badge>
                <span className="text-[12px] text-muted">{x.audience}</span>
              </div>
              <p className="text-[16px] font-semibold leading-snug text-ink">{x.hook}</p>
              <p className="mt-1 text-[14px] italic text-ink/70">“{x.message}”</p>
              <dl className="mt-3 divide-y divide-line border-t border-line">
                <Row k="Interaction" v={x.interaction} />
                <Row k="Experience" v={x.experience} />
                <Row k="Next action" v={x.next_action} />
                <Row k="Measurement" v={x.measurement} />
              </dl>
            </Card>
          ))}
        </div>
      </div>
    );

  if (kind === "short_form")
    return (
      <div className="space-y-4">
        <Header icon={Clapperboard} title="Five short-form series" note="Recurring formats for Instagram Reels, YouTube Shorts and similar." />
        <div className="grid gap-4 md:grid-cols-2">
          {extras.short_form.map((x, i) => (
            <Card key={i} className="p-5">
              <p className="eyebrow mb-1">Series {i + 1}</p>
              <p className="text-[17px] font-semibold text-ink">{x.title}</p>
              <p className="mt-1 text-[14px] text-ink/75">{x.hook}</p>
              <dl className="mt-3 divide-y divide-line border-t border-line">
                <Row k="Format" v={x.format} />
                <Row k="Structure" v={x.structure} />
                <Row k="Visual direction" v={x.visual_direction} />
                <Row k="Creators" v={x.creators} />
                <Row k="CTA" v={x.cta} />
                <Row k="Why here" v={x.why_destination} />
              </dl>
              <p className="mt-3 text-[12px] font-medium text-muted">Example episodes</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-[13px] text-ink/90">
                {x.episodes.map((e, j) => (
                  <li key={j}>{e}</li>
                ))}
              </ol>
            </Card>
          ))}
        </div>
      </div>
    );

  if (kind === "long_form")
    return (
      <div className="space-y-4">
        <Header icon={Film} title="Three long-form series" note="Designed to feel different from a conventional destination vlog." />
        <div className="grid gap-4 lg:grid-cols-3">
          {extras.long_form.map((x, i) => (
            <Card key={i} className="p-5">
              <p className="text-[17px] font-semibold text-ink">{x.name}</p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink/80">{x.storyline}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge tone="neutral">{x.episodes} episodes</Badge>
                <Badge tone="neutral">{x.duration}</Badge>
              </div>
              <dl className="mt-3 divide-y divide-line border-t border-line">
                <Row k="Host format" v={x.host_format} />
                <Row k="Locations" v={x.locations} />
                <Row k="Episode journey" v={x.journey} />
                <Row k="Brand integration" v={x.brand_integration} />
                <Row k="Distribution" v={x.distribution} />
                <Row k="Trip planning" v={x.planning_connection} />
              </dl>
            </Card>
          ))}
        </div>
      </div>
    );

  return (
    <div className="space-y-4">
      <Header icon={Zap} title="Crazy but realistic hero ideas" note="Bold enough for PR, but safe, legal and executable." />
      <div className="grid gap-4 lg:grid-cols-3">
        {extras.hero_ideas.map((x, i) => (
          <Card key={i} className="p-5">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge tone="peach">Hero {i + 1}</Badge>
              {x.digital_only && (
                <Badge tone="blue">
                  <MonitorSmartphone className="h-3 w-3" /> Digital only
                </Badge>
              )}
            </div>
            <p className="text-[17px] font-semibold leading-snug text-ink">{x.concept}</p>
            <dl className="mt-3 divide-y divide-line border-t border-line">
              <Row k="Mechanism" v={x.mechanism} />
              <Row k="Participation" v={x.participation} />
              <Row k="Production" v={x.production} />
              <Row k="Partners" v={x.partners} />
              <Row k="Feasibility" v={x.feasibility} />
              <Row k="Risks" v={x.risks} />
              <Row k="Budget" v={x.budget_complexity} />
              <Row k="Scapia link" v={x.scapia_connection} />
            </dl>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Header({ icon: Icon, title, note }: { icon: typeof Zap; title: string; note: string }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2.5">
        <Icon className="h-5 w-5 text-accent" />
        <div>
          <p className="text-[17px] font-semibold text-ink">{title}</p>
          <p className="text-[13px] text-muted">{note}</p>
        </div>
      </div>
      <KindLabel kind="hypothesis" />
    </div>
  );
}
