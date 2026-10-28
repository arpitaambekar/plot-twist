"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { api } from "@/lib/client";
import type { SearchHit } from "@/app/api/search/route";
import { cn } from "@/lib/utils";

const ORDER: SearchHit["type"][] = ["Destination", "Report", "News", "Campaign", "Contact", "Opportunity", "Library"];

export function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await api<{ hits: SearchHit[] }>(`/api/search?q=${encodeURIComponent(q)}`);
        setHits(r.hits);
        setActive(0);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const sorted = ORDER.flatMap((t) => hits.filter((h) => h.type === t));

  function go(h: SearchHit) {
    setOpen(false);
    setQ("");
    router.push(h.href);
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, sorted.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && sorted[active]) go(sorted[active]);
          else if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Search destinations, news, campaigns, contacts…"
        className="h-10 w-full rounded-full border border-line bg-surface pl-9 pr-14 text-sm placeholder:text-muted/80 focus:border-accent focus:outline-none focus:ring-4 focus:ring-soft-blue"
        role="combobox"
        aria-expanded={open && q.length >= 2}
        aria-controls="global-search-results"
        aria-label="Global search"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1.5 text-[11px] text-muted sm:block">⌘K</kbd>
      {open && q.trim().length >= 2 && (
        <div id="global-search-results" role="listbox" className="absolute left-0 right-0 top-12 z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-line bg-surface p-2 shadow-[var(--shadow-lift)]">
          {loading && (
            <p className="flex items-center gap-2 px-3 py-3 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </p>
          )}
          {!loading && sorted.length === 0 && <p className="px-3 py-3 text-sm text-muted">No matches for “{q}”.</p>}
          {ORDER.map((type) => {
            const group = sorted.filter((h) => h.type === type);
            if (!group.length) return null;
            return (
              <div key={type} className="py-1">
                <p className="eyebrow px-3 py-1.5 !text-[11px]">{type === "Library" ? "Campaign library" : type + "s"}</p>
                {group.map((h) => {
                  const idx = sorted.indexOf(h);
                  return (
                    <button
                      key={h.type + h.id}
                      role="option"
                      aria-selected={idx === active}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => go(h)}
                      className={cn("block w-full rounded-lg px-3 py-2 text-left", idx === active ? "bg-soft-blue" : "hover:bg-ink/[0.03]")}
                    >
                      <span className="block truncate text-sm font-medium text-ink">{h.title}</span>
                      <span className="block truncate text-[12px] text-muted">{h.subtitle}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
