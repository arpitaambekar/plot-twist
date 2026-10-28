"use client";
import { useState } from "react";
import { X, Eye } from "lucide-react";
import type { Destination, WatchItem } from "@/lib/types";
import { Card, Select } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { NEWS_CATEGORIES } from "@/lib/news/classify";

const KIND_LABEL: Record<WatchItem["kind"], string> = { destination: "Destination", tourism_board: "Board", category: "Category", india_market: "India market" };

export function WatchlistPanel({ items, destinations, boards, onToggle }: { items: WatchItem[]; destinations: Destination[]; boards: string[]; onToggle: (kind: WatchItem["kind"], value: string) => void }) {
  const [kind, setKind] = useState<WatchItem["kind"]>("destination");
  const [value, setValue] = useState("");
  const options = kind === "destination" ? destinations.map((d) => d.name) : kind === "tourism_board" ? boards : kind === "category" ? NEWS_CATEGORIES : ["India-market developments"];
  const indiaOn = items.some((i) => i.kind === "india_market");

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4 text-accent" />
        <h2 className="text-[15px] font-semibold text-ink">Your watchlist</h2>
      </div>
      <p className="mt-1 text-[12px] text-muted">New stories matching what you follow surface as alerts in the digest.</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {items.length === 0 && <p className="text-[13px] text-muted">Not following anything yet.</p>}
        {items.map((w) => (
          <span key={w.id} className="inline-flex items-center gap-1 rounded-full bg-soft-blue py-0.5 pl-2.5 pr-1 text-[12px] text-accent">
            <span className="text-accent/70">{KIND_LABEL[w.kind]}:</span> {w.value}
            <button onClick={() => onToggle(w.kind, w.value)} className="rounded-full p-0.5 hover:bg-accent/10" aria-label={`Unfollow ${w.value}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
        <Select
          aria-label="Follow type"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as WatchItem["kind"]);
            setValue("");
          }}
          className="h-9 text-[13px]"
        >
          <option value="destination">Destination</option>
          <option value="tourism_board">Board</option>
          <option value="category">Category</option>
          <option value="india_market">India market</option>
        </Select>
        <Select aria-label="Follow value" value={value} onChange={(e) => setValue(e.target.value)} className="h-9 text-[13px]">
          <option value="">Choose…</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      </div>
      <Button
        size="sm"
        variant="secondary"
        className="mt-2 w-full"
        disabled={!value || (kind === "india_market" && indiaOn) || items.some((i) => i.kind === kind && i.value === value)}
        onClick={() => {
          onToggle(kind, value);
          setValue("");
        }}
      >
        Follow
      </Button>
    </Card>
  );
}
