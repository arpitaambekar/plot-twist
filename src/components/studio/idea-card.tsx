"use client";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { Star, X, MoreHorizontal, Lock, GitMerge, Copy, RefreshCw, FileText, Columns3, KanbanSquare, PenLine, RotateCcw } from "lucide-react";
import type { CampaignIdea } from "@/lib/types";
import { Photo } from "@/components/media/photo";
import { Badge } from "@/components/ui/primitives";
import { SaveButton } from "@/components/shared/save-button";
import { DemoBadge } from "@/components/sources/status-badge";
import { cn } from "@/lib/utils";
import { feasibilityLabel, feasibilityTone } from "./types";

export type CardAction = "open" | "edit" | "shortlist" | "reject" | "restore" | "duplicate" | "regenerate" | "compare" | "combine" | "pitch" | "open-pitch" | "opportunity";

export function IdeaCard({
  idea,
  index,
  selected,
  saved,
  hasPitch,
  canEdit,
  busy,
  onSelect,
  onAction,
}: {
  idea: CampaignIdea;
  index: number;
  selected: boolean;
  saved: boolean;
  hasPitch: boolean;
  canEdit: boolean;
  busy: boolean;
  onSelect: (v: boolean) => void;
  onAction: (a: CardAction) => void;
}) {
  const c = idea.content;
  const shortlisted = idea.status === "shortlisted" || idea.status === "approved";
  const rejected = idea.status === "rejected";
  const channels = c.channels
    .split(/,|·|\//)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 4);

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-[14px] border bg-surface shadow-[var(--shadow-card)] transition-[box-shadow,border-color,opacity]",
        selected ? "border-accent ring-4 ring-soft-blue" : "border-line hover:shadow-[var(--shadow-lift)]",
        rejected && "opacity-60",
        busy && "animate-soft-pulse",
      )}
      aria-label={c.name}
    >
      <div className="relative">
        <Photo image={idea.image} label={idea.destination} className="h-36" />
        <label className="absolute left-3 top-3 flex h-7 cursor-pointer items-center gap-1.5 rounded-full bg-surface/90 px-2.5 text-[12px] font-medium text-ink shadow-sm backdrop-blur">
          <input type="checkbox" className="h-3.5 w-3.5 accent-[#4169D7]" checked={selected} onChange={(e) => onSelect(e.target.checked)} aria-label={`Select ${c.name}`} />
          {String(index + 1).padStart(2, "0")}
        </label>
        <div className="absolute right-3 top-3 flex gap-1.5">
          <SaveButton type="idea" id={idea.id} label={c.name} initial={saved} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral">{c.campaign_type}</Badge>
          {shortlisted && (
            <Badge tone="blue">
              <Star className="h-3 w-3 fill-current" /> {idea.status === "approved" ? "Approved" : "Shortlisted"}
            </Badge>
          )}
          {rejected && <Badge tone="danger">Rejected</Badge>}
          {idea.origin === "combined" && (
            <Badge tone="peach">
              <GitMerge className="h-3 w-3" /> Combined
            </Badge>
          )}
          {idea.locked_fields.length > 0 && (
            <span title={`${idea.locked_fields.length} field(s) edited by the team`} className="inline-flex items-center gap-1 text-[11px] text-muted">
              <Lock className="h-3 w-3" /> {idea.locked_fields.length}
            </span>
          )}
          {idea.is_demo && <DemoBadge />}
        </div>
        <button onClick={() => onAction("open")} className="text-left">
          <h3 className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ink transition-colors hover:text-accent">{c.name}</h3>
          <p className="mt-1 text-[14px] italic text-ink/70">{c.line}</p>
        </button>
        <p className="mt-2.5 line-clamp-3 text-[13.5px] leading-relaxed text-muted">{c.summary || c.big_idea}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge tone={feasibilityTone(c.feasibility)}>{feasibilityLabel(c.feasibility)}</Badge>
          {channels.map((ch) => (
            <span key={ch} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink/70">
              {ch}
            </span>
          ))}
        </div>
        {c.dependency_flags.length > 0 && <p className="mt-2 text-[11px] text-peach-ink">{c.dependency_flags.join(" · ")}</p>}
        <div className="flex-1" />
        <div className="mt-4 flex items-center gap-1 border-t border-line pt-3">
          <button onClick={() => onAction("open")} className="mr-auto rounded-full px-3 py-1.5 text-[13px] font-medium text-accent hover:bg-soft-blue">
            Open
          </button>
          {canEdit && (
            <>
              <button
                onClick={() => onAction("shortlist")}
                aria-pressed={shortlisted}
                title={shortlisted ? "Remove from shortlist" : "Shortlist"}
                className={cn("rounded-full p-2 transition-colors hover:bg-ink/5", shortlisted ? "text-accent" : "text-muted hover:text-ink")}
              >
                <Star className={cn("h-4 w-4", shortlisted && "fill-current")} />
                <span className="sr-only">Shortlist</span>
              </button>
              <button
                onClick={() => onAction(rejected ? "restore" : "reject")}
                title={rejected ? "Restore to draft" : "Reject"}
                className="rounded-full p-2 text-muted transition-colors hover:bg-ink/5 hover:text-danger"
              >
                {rejected ? <RotateCcw className="h-4 w-4" /> : <X className="h-4 w-4" />}
                <span className="sr-only">{rejected ? "Restore" : "Reject"}</span>
              </button>
            </>
          )}
          <Menu.Root>
            <Menu.Trigger className="rounded-full p-2 text-muted hover:bg-ink/5 hover:text-ink" aria-label={`More actions for ${c.name}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content align="end" sideOffset={6} className="z-50 min-w-[220px] rounded-xl border border-line bg-surface p-1.5 text-sm shadow-[var(--shadow-lift)]">
                <Item icon={PenLine} label="Edit" onSelect={() => onAction("edit")} />
                {canEdit && <Item icon={Copy} label="Duplicate" onSelect={() => onAction("duplicate")} />}
                {canEdit && <Item icon={RefreshCw} label="Regenerate" onSelect={() => onAction("regenerate")} />}
                <Menu.Separator className="my-1 h-px bg-line" />
                <Item icon={Columns3} label="Compare…" onSelect={() => onAction("compare")} />
                {canEdit && <Item icon={GitMerge} label="Combine…" onSelect={() => onAction("combine")} />}
                <Menu.Separator className="my-1 h-px bg-line" />
                {hasPitch ? (
                  <Item icon={FileText} label="Open pitch" onSelect={() => onAction("open-pitch")} />
                ) : (
                  canEdit && <Item icon={FileText} label="Develop into Pitch" onSelect={() => onAction("pitch")} disabled={rejected} />
                )}
                {canEdit && <Item icon={KanbanSquare} label="Add to Opportunity…" onSelect={() => onAction("opportunity")} />}
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </div>
    </article>
  );
}

function Item({ icon: Icon, label, onSelect, disabled }: { icon: typeof Star; label: string; onSelect: () => void; disabled?: boolean }) {
  return (
    <Menu.Item
      disabled={disabled}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-ink outline-none data-[disabled]:cursor-not-allowed data-[highlighted]:bg-soft-blue data-[disabled]:opacity-40"
    >
      <Icon className="h-4 w-4 text-muted" /> {label}
    </Menu.Item>
  );
}
