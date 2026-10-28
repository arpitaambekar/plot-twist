"use client";
import { useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { api } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import type { SavedType } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SaveButton({ type, id, label, initial = false, variant = "icon", className }: { type: SavedType; id: string; label: string; initial?: boolean; variant?: "icon" | "button"; className?: string }) {
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      const r = await api<{ saved: boolean }>("/api/saved", { json: { item_type: type, item_id: id, label } });
      setSaved(r.saved);
      toast(r.saved ? "One for the story. Saved." : "Removed from Saved.", r.saved ? "success" : "info");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  const Icon = saved ? BookmarkCheck : Bookmark;
  if (variant === "button")
    return (
      <button
        onClick={toggle}
        disabled={busy}
        aria-pressed={saved}
        className={cn("inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-medium text-ink hover:border-ink/25", saved && "border-accent/30 bg-soft-blue text-accent", className)}
      >
        <Icon className="h-4 w-4" /> {saved ? "Saved" : "Save"}
      </button>
    );
  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${label} from saved` : `Save ${label}`}
      title={saved ? "Saved" : "Save"}
      className={cn("inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface/90 text-ink shadow-sm backdrop-blur transition-colors hover:text-accent", saved && "text-accent", className)}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
