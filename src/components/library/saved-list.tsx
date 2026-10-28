"use client";
import { useState } from "react";
import Link from "next/link";
import { Bookmark, X, Newspaper, Compass, Sparkles, Users, Library, FileText, KanbanSquare } from "lucide-react";
import type { SavedType } from "@/lib/types";
import { Card, EmptyState } from "@/components/ui/primitives";
import { api } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import { cn, timeAgo } from "@/lib/utils";

export interface SavedRow {
  id: string;
  type: SavedType;
  title: string;
  subtitle: string | null;
  href: string | null;
  missing: boolean;
  saved_at: string;
}

const GROUPS: { type: SavedType; label: string; Icon: typeof Bookmark }[] = [
  { type: "report", label: "Research reports", Icon: Compass },
  { type: "idea", label: "Campaign ideas", Icon: Sparkles },
  { type: "pitch", label: "Pitches", Icon: FileText },
  { type: "contact", label: "Contacts", Icon: Users },
  { type: "news", label: "News", Icon: Newspaper },
  { type: "reference", label: "Campaign library", Icon: Library },
  { type: "opportunity", label: "Opportunities", Icon: KanbanSquare },
];

export function SavedList({ rows: initial }: { rows: SavedRow[] }) {
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState<SavedType | "all">("all");
  const toast = useToast();

  async function remove(r: SavedRow) {
    try {
      // The saved endpoint toggles: posting an already-saved item removes it.
      const res = await api<{ saved: boolean }>("/api/saved", { json: { item_type: r.type, item_id: r.id, label: r.title } });
      if (res.saved) {
        // It was not saved any more (removed elsewhere); undo the accidental re-save.
        await api("/api/saved", { json: { item_type: r.type, item_id: r.id, label: r.title } });
      }
      setRows((x) => x.filter((y) => !(y.id === r.id && y.type === r.type)));
      toast("Removed from Saved.", "info");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  if (!rows.length)
    return <EmptyState icon={<Bookmark className="h-8 w-8" />} title="Nothing saved yet." body="Use the bookmark on any story, report, campaign or contact to keep it here." />;

  const groups = GROUPS.map((g) => ({ ...g, rows: rows.filter((r) => r.type === g.type) })).filter((g) => g.rows.length);
  const shown = filter === "all" ? groups : groups.filter((g) => g.type === filter);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter saved items">
        <button role="tab" aria-selected={filter === "all"} onClick={() => setFilter("all")} className={cn("rounded-full border px-3 py-1 text-[13px]", filter === "all" ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink/75")}>
          All <span className="tabular-nums opacity-70">{rows.length}</span>
        </button>
        {groups.map((g) => (
          <button
            key={g.type}
            role="tab"
            aria-selected={filter === g.type}
            onClick={() => setFilter(g.type)}
            className={cn("rounded-full border px-3 py-1 text-[13px]", filter === g.type ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink/75")}
          >
            {g.label} <span className="tabular-nums opacity-70">{g.rows.length}</span>
          </button>
        ))}
      </div>
      {shown.map((g) => (
        <section key={g.type}>
          <h2 className="mb-3 flex items-center gap-2 text-[17px] font-semibold text-ink">
            <g.Icon className="h-4 w-4 text-muted" /> {g.label} <span className="text-[13px] font-normal text-muted">{g.rows.length}</span>
          </h2>
          <Card className="divide-y divide-line">
            {g.rows.map((r) => (
              <div key={r.type + r.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  {r.href && !r.missing ? (
                    <Link href={r.href} className="block truncate text-[15px] font-medium text-ink hover:text-accent">
                      {r.title}
                    </Link>
                  ) : (
                    <p className="truncate text-[15px] font-medium text-ink/60">{r.title}</p>
                  )}
                  <p className="truncate text-[12px] text-muted">{r.missing ? "This item no longer exists." : r.subtitle}</p>
                </div>
                <span className="hidden shrink-0 text-[12px] text-muted sm:block">Saved {timeAgo(r.saved_at)}</span>
                <button onClick={() => remove(r)} className="rounded-full p-1.5 text-muted hover:bg-ink/5 hover:text-ink" aria-label={`Remove ${r.title} from saved`}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </Card>
        </section>
      ))}
    </div>
  );
}
