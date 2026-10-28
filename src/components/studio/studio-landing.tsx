"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Upload, ClipboardPaste, Compass, Sparkles, Check, Library, ArrowRight, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, Input, Label, Notice, Select, Textarea } from "@/components/ui/primitives";
import { IntegrationNotice } from "@/components/shared/integration-notice";
import { DemoBadge, ClaimStatusBadge } from "@/components/sources/status-badge";
import { Photo } from "@/components/media/photo";
import { useSession } from "@/components/shell/user-context";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import { cn, fmtDate } from "@/lib/utils";
import type { ClaimStatus, ImageRef } from "@/lib/types";

export interface ReportOption {
  id: string;
  destination: string;
  version: number;
  status: string;
  updated_at: string;
  evidence_pct: number | null;
  claims: number;
  traveller: string;
  board: string | null;
  is_demo: boolean;
}

export interface SetSummary {
  id: string;
  title: string;
  destination: string;
  status: string;
  created_at: string;
  idea_count: number;
  shortlisted: number;
  cover: ImageRef | null;
  basis: string;
  is_demo: boolean;
}

interface ReferenceInfo {
  id: string;
  name: string;
  board: string;
  destination: string;
  mechanism: string;
  idea: string;
  learning: string;
  verification: ClaimStatus;
}

const OBJECTIVES = [
  "Increase destination awareness",
  "Increase Indian visitors",
  "Promote secondary destinations",
  "Encourage longer stays",
  "Promote shoulder-season travel",
  "Improve destination consideration",
  "Encourage trip planning",
  "Generate travel searches",
  "Support bookings",
  "Promote culture, food or adventure",
];
const BUDGETS = ["Lean", "Mid-scale", "Premium", "Hero activation"];
const AMBITIONS = ["Practical", "Bold", "Wild but executable"];
const CHANNELS = ["In-app", "Push & email", "Instagram Reels", "YouTube Shorts", "Long-form YouTube", "Creators", "Paid social", "PR", "Experiential", "Interactive / gamified"];

type Mode = "report" | "upload" | "paste" | "destination";

export function StudioLanding({
  reports,
  sets,
  initialReportId,
  initialDestination,
  reference,
}: {
  reports: ReportOption[];
  sets: SetSummary[];
  initialReportId: string | null;
  initialDestination: string;
  reference: ReferenceInfo | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const { can, integrations } = useSession();
  const [mode, setMode] = useState<Mode>(initialReportId || reports.length ? "report" : initialDestination ? "destination" : "paste");
  const [reportId, setReportId] = useState<string | null>(initialReportId ?? reports[0]?.id ?? null);
  const [reportFilter, setReportFilter] = useState("");
  const [pasted, setPasted] = useState("");
  const [upload, setUpload] = useState<{ filename: string; text: string; chars: number; urls: string[] } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [useReference, setUseReference] = useState(Boolean(reference));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = reports.find((r) => r.id === reportId) ?? null;
  const [brief, setBrief] = useState({
    destination: initialDestination || selected?.destination || "",
    tourism_board: "",
    objective: "",
    audience: "",
    season: "",
    budget_tier: "",
    duration: "",
    focus_areas: "",
    channels: [] as string[],
    positioning: "",
    ambition: "",
  });

  const filteredReports = useMemo(() => {
    const q = reportFilter.toLowerCase();
    return q ? reports.filter((r) => r.destination.toLowerCase().includes(q)) : reports;
  }, [reports, reportFilter]);

  const set = (k: keyof typeof brief, v: string | string[]) => setBrief((b) => ({ ...b, [k]: v }));

  async function onFile(f: File | undefined) {
    if (!f) return;
    setError(null);
    if (f.size > 8 * 1024 * 1024) {
      setError("That file is larger than 8 MB.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Upload failed");
      setUpload(body);
      toast(`Read ${body.chars.toLocaleString()} characters from ${body.filename}.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const canGenerate =
    can("editor") &&
    integrations.ai &&
    (mode === "report" ? Boolean(selected) : mode === "upload" ? Boolean(upload) && Boolean(brief.destination.trim()) : mode === "paste" ? pasted.trim().length >= 200 && Boolean(brief.destination.trim()) : false);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const body = {
        input_mode: mode,
        report_id: mode === "report" ? reportId : undefined,
        supplied_research: mode === "upload" ? upload?.text : mode === "paste" ? pasted : undefined,
        supplied_filename: mode === "upload" ? upload?.filename : undefined,
        brief: {
          ...brief,
          destination: mode === "report" ? brief.destination || selected?.destination || "" : brief.destination,
          budget_tier: brief.budget_tier as never,
          ambition: brief.ambition as never,
          inspiration_reference_id: reference && useReference ? reference.id : undefined,
        },
      };
      const r = await api<{ set: { id: string }; duplicate?: boolean }>("/api/campaigns", { json: body });
      if (r.duplicate) toast("You just started this exact brief. Opening it.", "info");
      router.push(`/studio/${r.set.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const MODES: { key: Mode; label: string; icon: typeof FileText; hint: string }[] = [
    { key: "report", label: "Destination report", icon: FileText, hint: "Best: sourced facts travel with every idea" },
    { key: "upload", label: "Upload Word or PDF", icon: Upload, hint: "Your own research document" },
    { key: "paste", label: "Paste research", icon: ClipboardPaste, hint: "Notes, articles, briefs" },
    { key: "destination", label: "Start with a destination", icon: Compass, hint: "Run research first" },
  ];

  return (
    <div className="space-y-10">
      <IntegrationNotice needs={["ai"]} />

      {reference && (
        <Card className={cn("overflow-hidden", useReference ? "border-accent/30" : "")}>
          <div className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="blue">
                  <Library className="h-3 w-3" /> Used as inspiration
                </Badge>
                <ClaimStatusBadge status={reference.verification} />
              </div>
              <p className="mt-2 text-[17px] font-semibold text-ink">
                {reference.name} <span className="font-normal text-muted">· {reference.board}</span>
              </p>
              <p className="mt-1.5 text-sm text-ink/80">
                <span className="font-medium">Mechanism:</span> {reference.idea} {reference.mechanism}
              </p>
              <p className="mt-1 text-sm text-ink/80">
                <span className="font-medium">Learning:</span> {reference.learning}
              </p>
              <p className="mt-2 text-[12px] text-muted">The studio borrows the mechanism and the learning only. Every idea will be an original, destination-specific execution, never a copy.</p>
            </div>
            <Button variant={useReference ? "secondary" : "primary"} size="sm" onClick={() => setUseReference((u) => !u)}>
              {useReference ? (
                <>
                  <X className="h-3.5 w-3.5" /> Don&apos;t use
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" /> Use as inspiration
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {/* Step 1: research */}
          <Card className="p-6">
            <p className="eyebrow mb-1">Step 1</p>
            <h2 className="text-[20px] font-semibold tracking-[-0.01em]">What&apos;s the research?</h2>
            <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4" role="tablist" aria-label="Research input">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  role="tab"
                  aria-selected={mode === m.key}
                  onClick={() => setMode(m.key)}
                  className={cn(
                    "flex flex-col items-start gap-1.5 rounded-xl border p-3.5 text-left transition-colors",
                    mode === m.key ? "border-accent bg-soft-blue/60" : "border-line hover:border-ink/25",
                  )}
                >
                  <m.icon className={cn("h-4 w-4", mode === m.key ? "text-accent" : "text-muted")} />
                  <span className="text-sm font-medium text-ink">{m.label}</span>
                  <span className="text-[12px] leading-snug text-muted">{m.hint}</span>
                </button>
              ))}
            </div>

            <div className="mt-6">
              {mode === "report" &&
                (reports.length ? (
                  <div className="space-y-3">
                    {reports.length > 6 && <Input placeholder="Filter reports by destination…" value={reportFilter} onChange={(e) => setReportFilter(e.target.value)} />}
                    <div className="grid max-h-[360px] grid-cols-1 gap-2 overflow-y-auto pr-1 scrollbar-thin" role="radiogroup" aria-label="Destination reports">
                      {filteredReports.map((r) => (
                        <button
                          key={r.id}
                          role="radio"
                          aria-checked={reportId === r.id}
                          onClick={() => {
                            setReportId(r.id);
                            set("destination", r.destination);
                          }}
                          className={cn("flex w-full min-w-0 items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition-colors", reportId === r.id ? "border-accent bg-soft-blue/50" : "border-line hover:border-ink/25")}
                        >
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 text-sm font-medium text-ink">
                              {r.destination} <span className="font-normal text-muted">v{r.version}</span> {r.is_demo && <DemoBadge />}
                            </p>
                            <p className="mt-0.5 truncate text-[12px] text-muted">
                              {r.traveller} travellers · Updated {fmtDate(r.updated_at)}
                              {r.board ? ` · ${r.board}` : ""}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            {r.evidence_pct !== null && (
                              <Badge tone={r.evidence_pct >= 70 ? "mint" : "peach"}>
                                <ShieldCheck className="h-3 w-3" /> {r.evidence_pct}% evidenced
                              </Badge>
                            )}
                            <p className="mt-1 text-[11px] text-muted">{r.claims} sourced claims</p>
                          </div>
                        </button>
                      ))}
                      {!filteredReports.length && <p className="py-4 text-sm text-muted">No reports match “{reportFilter}”.</p>}
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="No destination reports yet"
                    body="Research a destination first. Its verified facts, sources and insights will travel straight into the studio."
                    action={
                      <Link href="/research" className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover">
                        Research a destination <ArrowRight className="h-4 w-4" />
                      </Link>
                    }
                  />
                ))}

              {mode === "upload" && (
                <div className="space-y-4">
                  <div
                    className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-ivory/60 px-6 py-8 text-center"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      onFile(e.dataTransfer.files?.[0]);
                    }}
                  >
                    <Upload className="h-5 w-5 text-muted" />
                    <p className="mt-2 text-sm font-medium text-ink">{upload ? upload.filename : "Drop a .docx or .pdf here"}</p>
                    <p className="mt-1 text-[12px] text-muted">
                      {upload ? `${upload.chars.toLocaleString()} characters read · ${upload.urls.length} reference links kept` : "Up to 8 MB. Text is extracted on the server; the file itself is not stored."}
                    </p>
                    <input ref={fileRef} type="file" accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" id="studio-upload" onChange={(e) => onFile(e.target.files?.[0])} />
                    <label htmlFor="studio-upload" className="mt-4 inline-flex h-9 cursor-pointer items-center rounded-full border border-line bg-surface px-4 text-[13px] font-medium hover:border-ink/25">
                      {uploading ? "Reading…" : upload ? "Choose another file" : "Choose file"}
                    </label>
                  </div>
                  <p className="text-[12px] text-muted">Uploaded research is treated as untrusted and unverified. Ideas built on it will be labelled as such.</p>
                </div>
              )}

              {mode === "paste" && (
                <div>
                  <Label htmlFor="paste">Research notes</Label>
                  <Textarea id="paste" rows={9} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Paste destination research, articles or briefing notes. Include source links where you have them." />
                  <p className="mt-1.5 text-[12px] text-muted">{pasted.trim().length < 200 ? `${200 - pasted.trim().length} more characters needed.` : `${pasted.trim().length.toLocaleString()} characters. Treated as unverified research.`}</p>
                </div>
              )}

              {mode === "destination" && (
                <div className="space-y-3">
                  <Label htmlFor="dest-only">Destination</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input id="dest-only" value={brief.destination} onChange={(e) => set("destination", e.target.value)} placeholder="e.g. Okinawa, Uzbekistan, Andalusia" />
                    <Link
                      href={`/research?destination=${encodeURIComponent(brief.destination)}`}
                      className={cn("inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover", !brief.destination.trim() && "pointer-events-none opacity-50")}
                    >
                      Research it first <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                  <p className="text-[12px] text-muted">Ideas are only as good as the research behind them. Once the report is ready, use “Turn This Into Campaign Ideas” and it arrives here with every source attached.</p>
                </div>
              )}
            </div>
          </Card>

          {/* Step 2: brief */}
          <Card className="p-6">
            <p className="eyebrow mb-1">Step 2 · Optional</p>
            <h2 className="text-[20px] font-semibold tracking-[-0.01em]">Shape the brief</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="b-dest">Destination</Label>
                <Input id="b-dest" value={brief.destination} onChange={(e) => set("destination", e.target.value)} placeholder={selected?.destination ?? "Destination"} />
              </div>
              <div>
                <Label htmlFor="b-board">Tourism board</Label>
                <Input id="b-board" value={brief.tourism_board} onChange={(e) => set("tourism_board", e.target.value)} placeholder={selected?.board ?? "e.g. national tourism organisation"} />
              </div>
              <div>
                <Label htmlFor="b-obj">Campaign objective</Label>
                <Select id="b-obj" value={brief.objective} onChange={(e) => set("objective", e.target.value)}>
                  <option value="">Any objective</option>
                  {OBJECTIVES.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="b-aud">Target audience</Label>
                <Input id="b-aud" value={brief.audience} onChange={(e) => set("audience", e.target.value)} placeholder="e.g. first-time international couples, metro Gen Z" />
              </div>
              <div>
                <Label htmlFor="b-season">Travel season</Label>
                <Input id="b-season" value={brief.season} onChange={(e) => set("season", e.target.value)} placeholder="e.g. Oct–Dec, Indian summer holidays" />
              </div>
              <div>
                <Label htmlFor="b-dur">Campaign duration</Label>
                <Input id="b-dur" value={brief.duration} onChange={(e) => set("duration", e.target.value)} placeholder="e.g. 8 weeks" />
              </div>
              <div>
                <Label htmlFor="b-budget">Budget tier</Label>
                <Select id="b-budget" value={brief.budget_tier} onChange={(e) => set("budget_tier", e.target.value)}>
                  <option value="">Any tier</option>
                  {BUDGETS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="b-amb">Creative ambition</Label>
                <Select id="b-amb" value={brief.ambition} onChange={(e) => set("ambition", e.target.value)}>
                  <option value="">Mixed</option>
                  {AMBITIONS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="b-focus">Specific regions or attractions</Label>
                <Input id="b-focus" value={brief.focus_areas} onChange={(e) => set("focus_areas", e.target.value)} placeholder="e.g. Hokuriku region, Kanazawa, Noto Peninsula" />
              </div>
              <div className="sm:col-span-2">
                <Label>Preferred channels</Label>
                <div className="flex flex-wrap gap-2">
                  {CHANNELS.map((c) => {
                    const on = brief.channels.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set("channels", on ? brief.channels.filter((x) => x !== c) : [...brief.channels, c])}
                        className={cn("rounded-full border px-3 py-1.5 text-[13px] transition-colors", on ? "border-accent bg-soft-blue text-accent" : "border-line text-ink/75 hover:border-ink/25")}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="b-pos">Existing brand positioning</Label>
                <Textarea id="b-pos" rows={2} value={brief.positioning} onChange={(e) => set("positioning", e.target.value)} placeholder="The destination's current positioning or the board's stated priorities, if known" />
              </div>
            </div>
          </Card>

          {error && <Notice tone="danger">{error}</Notice>}
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button size="lg" onClick={generate} loading={busy} disabled={!canGenerate}>
              <Sparkles className="h-4 w-4" /> Generate 10 Campaign Ideas
            </Button>
            <p className="text-[13px] text-muted">
              {!can("editor") ? "Viewers can browse but not generate." : mode === "destination" ? "Research the destination first, then come back." : "Takes a couple of minutes. You can leave the page; it keeps going."}
            </p>
          </div>
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <p className="eyebrow mb-3">What you&apos;ll get</p>
            <ul className="space-y-3 text-sm text-ink/85">
              {[
                ["10 distinct concepts", "Each tied to the research findings behind it"],
                ["8–10 in-app ideas", "Specific placements, not generic banners"],
                ["5 short-form series", "Recurring formats with example episodes"],
                ["3 long-form series", "Beyond the usual destination vlog"],
                ["3 hero ideas", "PR-worthy, at least one fully digital"],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-mint-ink" />
                  <span>
                    <span className="font-medium">{t}</span>
                    <span className="block text-[12px] text-muted">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5 text-[13px] text-muted">
            <p className="mb-1.5 font-medium text-ink">A note on Scapia integrations</p>
            Ideas may suggest in-app placements, landing pages, push, creator work and interactive formats. These are potential components. Anything needing new product work, a partner or an integration is flagged on the idea.
          </Card>
        </aside>
      </div>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="eyebrow mb-1.5">Your studio</p>
            <h2 className="text-[21px] font-semibold tracking-[-0.01em]">Previous sessions</h2>
          </div>
        </div>
        {sets.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sets.map((s) => (
              <Link key={s.id} href={`/studio/${s.id}`} className="group overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-lift)]">
                <Photo image={s.cover} label={s.destination} className="h-32" attribution="none" />
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    {s.status === "generating" && <Badge tone="blue">Generating</Badge>}
                    {s.status === "failed" && <Badge tone="danger">Failed</Badge>}
                    {s.is_demo && <DemoBadge />}
                  </div>
                  <p className="mt-1.5 line-clamp-1 text-[16px] font-semibold text-ink group-hover:text-accent">{s.title}</p>
                  <p className="mt-0.5 text-[12px] text-muted">
                    {s.idea_count} ideas · {s.shortlisted} shortlisted · {fmtDate(s.created_at)}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-muted">{s.basis}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="No studio sessions yet" body="Your generated campaign sets will live here, ready to edit, compare and pitch." />
        )}
      </section>
    </div>
  );
}
