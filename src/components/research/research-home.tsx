"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, MapPin, Clock } from "lucide-react";
import type { ImageRef, ReportOptions } from "@/lib/types";
import { PageHeader, Card, Select, Label, Input, Notice, Badge, SectionTitle, EmptyState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Photo } from "@/components/media/photo";
import { IntegrationNotice } from "@/components/shared/integration-notice";
import { DemoBadge } from "@/components/sources/status-badge";
import { useSession } from "@/components/shell/user-context";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/client";
import { cn, fmtDate, timeAgo } from "@/lib/utils";

export interface DirectoryCard {
  id: string;
  name: string;
  continent: string;
  tourism_board: string | null;
  tagline: string | null;
  image: ImageRef | null;
  report_id: string | null;
}
export interface ReportSummary {
  id: string;
  destination_name: string;
  query: string;
  version: number;
  status: string;
  options: ReportOptions;
  evidence_pct: number | null;
  claims: number | null;
  unresolved: number | null;
  updated_at: string;
  image: ImageRef | null;
  is_demo: boolean;
}

const TRAVELLERS = ["All", "Couples", "Families", "Solo travellers", "Friends", "Adventure travellers", "Luxury travellers"] as const;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SEASONS = ["Spring", "Summer", "Autumn", "Winter", "Indian summer holidays (Apr–Jun)", "Diwali holidays (Oct–Nov)", "Year-end holidays (Dec–Jan)"];
const KINDS = [
  ["city", "City"],
  ["region", "Region"],
  ["island", "Island"],
  ["province", "Province or state"],
  ["area", "Destination area"],
  ["country", "Country"],
] as const;

type Cached = { report_id: string; cached_at?: string };

export function ResearchHome({ directory, reports, prefill }: { directory: DirectoryCard[]; reports: ReportSummary[]; prefill: string }) {
  const router = useRouter();
  const toast = useToast();
  const { can } = useSession();
  const [q, setQ] = useState(prefill);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [traveller, setTraveller] = useState<(typeof TRAVELLERS)[number]>("All");
  const [period, setPeriod] = useState("Any season");
  const [depth, setDepth] = useState<"quick" | "comprehensive">("comprehensive");
  const [kind, setKind] = useState<string>("city");
  const [country, setCountry] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState<Cached | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return [];
    return directory.filter((d) => d.name.toLowerCase().includes(n) || (d.tourism_board ?? "").toLowerCase().includes(n)).slice(0, 6);
  }, [q, directory]);
  const inDirectory = directory.some((d) => d.name.toLowerCase() === q.trim().toLowerCase());
  const needsDisambiguation = q.trim().length >= 2 && !inDirectory;

  function pick(name: string) {
    setQ(name);
    setOpen(false);
    setCached(null);
    inputRef.current?.focus();
  }

  async function submit(force = false) {
    if (q.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ report_id: string; status: string; cached_at?: string }>("/api/research", {
        json: {
          destination: q.trim(),
          kind: needsDisambiguation ? kind : "country",
          country: needsDisambiguation && kind !== "country" ? country.trim() || undefined : undefined,
          options: { traveller_type: traveller, travel_period: period, depth },
          force,
        },
      });
      if (r.status === "cached") {
        setCached({ report_id: r.report_id, cached_at: r.cached_at });
        setBusy(false);
        return;
      }
      if (r.status === "in_progress") toast("That research is already running. Opening it now.", "info");
      router.push(`/research/${r.report_id}`);
    } catch (e) {
      setError(e instanceof ApiError && e.code === "not_configured" ? e.message : (e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Beyond the Obvious" title="There's more to the story." subtitle="Find the places, people and experiences beyond the usual itinerary." />
      <div className="mb-6">
        <IntegrationNotice needs={["ai", "search"]} />
      </div>

      <Card className="p-5 md:p-7">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(false);
          }}
        >
          <label htmlFor="dest-q" className="sr-only">
            Destination
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
            <input
              id="dest-q"
              ref={inputRef}
              value={q}
              autoComplete="off"
              onChange={(e) => {
                setQ(e.target.value);
                setOpen(true);
                setActive(0);
                setCached(null);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              onKeyDown={(e) => {
                if (!open || !matches.length) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, matches.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter" && matches[active] && matches[active].name.toLowerCase() !== q.trim().toLowerCase()) {
                  e.preventDefault();
                  pick(matches[active].name);
                } else if (e.key === "Escape") setOpen(false);
              }}
              placeholder="Where should we explore next?"
              className="h-16 w-full rounded-2xl border border-line bg-ivory/50 pl-14 pr-4 text-[19px] text-ink placeholder:text-muted/70 focus:border-accent focus:bg-surface focus:outline-none focus:ring-4 focus:ring-soft-blue md:text-[21px]"
              role="combobox"
              aria-expanded={open && matches.length > 0}
              aria-controls="dest-suggestions"
              aria-autocomplete="list"
            />
            {open && matches.length > 0 && (
              <ul id="dest-suggestions" role="listbox" className="absolute left-0 right-0 top-[70px] z-30 rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-lift)]">
                {matches.map((m, i) => (
                  <li key={m.id} role="option" aria-selected={i === active}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(m.name)}
                      onMouseEnter={() => setActive(i)}
                      className={cn("flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left", i === active ? "bg-soft-blue" : "hover:bg-ink/[0.03]")}
                    >
                      <span className="text-[15px] font-medium text-ink">{m.name}</span>
                      <span className="text-[12px] text-muted">
                        {m.continent} · {m.tourism_board ?? "Board not listed"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {needsDisambiguation && (
            <div className="mt-4 rounded-xl border border-line bg-ivory/60 p-4">
              <p className="mb-3 text-[13px] text-ink">
                <MapPin className="mr-1 inline h-3.5 w-3.5 text-accent" />
                “{q.trim()}” isn&apos;t in the destination directory. Help us research the right place:
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="kind">What kind of place is it?</Label>
                  <Select id="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
                    {KINDS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </div>
                {kind !== "country" && (
                  <div>
                    <Label htmlFor="country" hint="(avoids mixing up places with the same name)">
                      Country
                    </Label>
                    <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. South Korea" />
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
            <div>
              <Label htmlFor="traveller">Traveller type</Label>
              <Select id="traveller" value={traveller} onChange={(e) => setTraveller(e.target.value as (typeof TRAVELLERS)[number])}>
                {TRAVELLERS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="period">Travel period</Label>
              <Select id="period" value={period} onChange={(e) => setPeriod(e.target.value)}>
                <option>Any season</option>
                <optgroup label="Month">
                  {MONTHS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </optgroup>
                <optgroup label="Season">
                  {SEASONS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </optgroup>
              </Select>
            </div>
            <div>
              <span className="mb-1.5 block text-[13px] font-medium text-ink">Research depth</span>
              <div className="inline-flex h-10 rounded-full border border-line p-0.5" role="radiogroup" aria-label="Research depth">
                {(
                  [
                    ["quick", "Quick overview"],
                    ["comprehensive", "Comprehensive"],
                  ] as const
                ).map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={depth === v}
                    onClick={() => setDepth(v)}
                    className={cn("rounded-full px-3.5 text-[13px] font-medium transition-colors", depth === v ? "bg-ink text-white" : "text-ink/70 hover:text-ink")}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <Button type="submit" size="lg" loading={busy} disabled={!can("editor") || q.trim().length < 2} title={can("editor") ? undefined : "Viewers can read reports but not start research"}>
              Research this destination <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          {!can("editor") && <p className="mt-3 text-[12px] text-muted">You have viewer access: you can read reports, but starting research needs editor access.</p>}
        </form>

        {cached && (
          <div className="mt-5">
            <Notice
              tone="blue"
              title="Recent research already exists"
              action={
                <div className="flex gap-2">
                  <Link href={`/research/${cached.report_id}`} className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover">
                    Open report
                  </Link>
                  <Button size="sm" variant="secondary" loading={busy} onClick={() => submit(true)}>
                    Refresh anyway
                  </Button>
                </div>
              }
            >
              A report for {q.trim()} with these options was updated {cached.cached_at ? timeAgo(cached.cached_at) : "recently"}. Reusing it avoids repeating costly research. Refreshing creates a new version and keeps the old one.
            </Notice>
          </div>
        )}
        {error && (
          <div className="mt-5">
            <Notice tone="danger" title="Research could not start">
              {error}
            </Notice>
          </div>
        )}
      </Card>

      {reports.length > 0 && (
        <section className="mt-14">
          <SectionTitle kicker="Your research" title="Previous reports" />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {reports.slice(0, 12).map((r) => (
              <Link key={r.id} href={`/research/${r.id}`} className="group flex gap-4 rounded-[14px] border border-line bg-surface p-3 transition-shadow hover:shadow-[var(--shadow-lift)]">
                <Photo image={r.image} label={r.destination_name} className="h-20 w-24 shrink-0 rounded-lg" attribution="none" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-ink group-hover:text-accent">{r.query}</p>
                    {r.is_demo && <DemoBadge />}
                  </div>
                  <p className="mt-0.5 text-[12px] text-muted">
                    v{r.version || 1} · {r.options.depth === "quick" ? "Quick" : "Comprehensive"} · {r.options.traveller_type} · {r.options.travel_period}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <StatusPill status={r.status} />
                    {r.evidence_pct !== null && (
                      <Badge tone={r.evidence_pct >= 80 ? "mint" : r.evidence_pct >= 60 ? "blue" : "peach"}>
                        {r.evidence_pct}% of {r.claims} claims evidenced
                      </Badge>
                    )}
                    <span className="inline-flex items-center gap-1 text-[12px] text-muted">
                      <Clock className="h-3 w-3" /> {fmtDate(r.updated_at)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-14">
        <SectionTitle kicker="Destination directory" title="Start with a familiar name" />
        <p className="-mt-2 mb-5 max-w-2xl text-sm text-muted">These are directory entries, not pre-verified reports. Tourism-board details come from an internal list and are confirmed when you run research.</p>
        {directory.length === 0 ? (
          <EmptyState title="No destinations in the directory yet." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {directory.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  pick(d.name);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="group overflow-hidden rounded-[14px] border border-line bg-surface text-left transition-shadow hover:shadow-[var(--shadow-lift)]"
              >
                <Photo image={d.image} label={d.name} className="aspect-[4/3] w-full" imgClassName="transition-transform duration-500 group-hover:scale-[1.03]" />
                <div className="p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-ink">{d.name}</p>
                    {d.report_id && <Badge tone="mint">Report</Badge>}
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-muted">{d.tourism_board ?? d.continent}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { tone: "mint" | "blue" | "peach" | "danger" | "neutral"; label: string }> = {
    completed: { tone: "mint", label: "Completed" },
    partial: { tone: "peach", label: "Partial" },
    generating: { tone: "blue", label: "Researching" },
    failed: { tone: "danger", label: "Failed" },
  };
  const m = map[status] ?? { tone: "neutral" as const, label: status };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
