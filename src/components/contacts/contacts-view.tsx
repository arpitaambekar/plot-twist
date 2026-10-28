"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, Loader2, AlertTriangle, CheckCircle2, RotateCw } from "lucide-react";
import type { Contact, ContactSearch, ContactStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, Input, Label, Notice, PageHeader, Select, SectionTitle } from "@/components/ui/primitives";
import { IntegrationNotice } from "@/components/shared/integration-notice";
import { useSession } from "@/components/shell/user-context";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/client";
import { daysSince, timeAgo } from "@/lib/utils";
import { ContactCard } from "./contact-card";

const STATUSES: ContactStatus[] = ["Officially Verified", "Cross-Verified", "Needs Verification"];
const EXAMPLES = ["Austria Tourism India", "Tourism New Zealand India", "Philippines tourism board India", "Spain Tourism Mumbai", "Azerbaijan tourism representation India"];

interface SearchState {
  search: ContactSearch;
  contacts: Contact[];
  job: { status: string; label: string; log: { at: string; message: string }[]; error: string | null } | null;
  reused?: boolean;
}

export function ContactsView({
  contacts,
  destinations,
  recentSearches,
  savedIds,
  initialQuery,
  initialDestination,
}: {
  contacts: Contact[];
  destinations: { name: string; board: string | null }[];
  recentSearches: ContactSearch[];
  savedIds: string[];
  initialQuery: string;
  initialDestination: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const { can, integrations } = useSession();
  const [query, setQuery] = useState(initialQuery);
  const [dest, setDest] = useState(initialDestination);
  const [state, setState] = useState<SearchState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const started = useRef(false);

  const [f, setF] = useState({ destination: "", board: "", role: "", office: "any", agency: "any", status: "", verified: "any" });

  const poll = useCallback(
    async (id: string) => {
      for (let i = 0; i < 180; i++) {
        const r = await api<SearchState>(`/api/contacts/searches/${id}`);
        setState((s) => ({ ...r, reused: s?.reused }));
        if (r.search.status !== "running") {
          if (r.search.status === "completed") router.refresh();
          return;
        }
        await new Promise((res) => setTimeout(res, 2000));
      }
    },
    [router],
  );

  const run = useCallback(
    async (q: string, destination: string, force = false) => {
      if (q.trim().length < 2) return;
      setBusy(true);
      setError(null);
      setState(null);
      try {
        const r = await api<{ search: ContactSearch; reused?: boolean }>("/api/contacts/search", { json: { query: q.trim(), destination: destination || null, force } });
        setState({ search: r.search, contacts: [], job: null, reused: r.reused });
        await poll(r.search.id);
      } catch (e) {
        setError(e as ApiError);
      } finally {
        setBusy(false);
      }
    },
    [poll],
  );

  useEffect(() => {
    if (initialQuery && !started.current && can("editor") && integrations.search) {
      started.current = true;
      void run(initialQuery, initialDestination);
    }
  }, [initialQuery, initialDestination, run, can, integrations.search]);

  const boards = useMemo(() => [...new Set(contacts.map((c) => c.organisation))].sort(), [contacts]);
  const dests = useMemo(() => [...new Set([...contacts.map((c) => c.destination)])].sort(), [contacts]);

  const filtered = contacts.filter((c) => {
    if (f.destination && c.destination !== f.destination) return false;
    if (f.board && c.organisation !== f.board) return false;
    if (f.role && !c.job_title.toLowerCase().includes(f.role.toLowerCase())) return false;
    if (f.office === "yes" && !c.india_office) return false;
    if (f.agency === "yes" && !c.agency) return false;
    if (f.status && c.status !== f.status) return false;
    const age = daysSince(c.last_verified_at);
    if (f.verified === "30" && age > 30) return false;
    if (f.verified === "90" && age > 90) return false;
    if (f.verified === "stale" && age <= 90) return false;
    return true;
  });

  return (
    <div>
      <PageHeader eyebrow="The People Behind the Plot" title="Find the right people." subtitle="Every great partnership starts with a conversation." />

      <Card className="p-5 md:p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(query, dest);
          }}
          className="flex flex-col gap-3 md:flex-row"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a destination, tourism board or representative..."
              className="h-14 rounded-2xl pl-12 text-[16px]"
              aria-label="Contact search"
              maxLength={160}
            />
          </div>
          <Select value={dest} onChange={(e) => setDest(e.target.value)} className="h-14 rounded-2xl md:w-56" aria-label="Destination">
            <option value="">Any destination</option>
            {destinations.map((d) => (
              <option key={d.name}>{d.name}</option>
            ))}
          </Select>
          <Button type="submit" size="lg" className="h-14 px-7" loading={busy} disabled={!can("editor") || query.trim().length < 2}>
            Find Contacts
          </Button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted">
          <span>Try:</span>
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => setQuery(ex)} className="rounded-full border border-line px-2.5 py-0.5 hover:border-ink/30 hover:text-ink">
              {ex}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-muted">
          Contacts come only from public professional sources. Names and roles must appear in the cited source text; emails and phone numbers are shown only when published. Nothing is guessed.
        </p>
        {!can("editor") && <p className="mt-2 text-[12px] text-peach-ink">Viewers can browse the directory. Ask an editor to run new searches.</p>}
      </Card>

      <div className="mt-4 space-y-3">
        <IntegrationNotice needs={["search", "ai"]} />
        {error && (
          <Notice tone="danger" title={error.code === "not_configured" ? "Search isn't configured" : "Search couldn't start"}>
            {error.message}
          </Notice>
        )}
      </div>

      {state && <SearchPanel state={state} savedIds={savedIds} onRerun={() => run(state.search.query, dest, true)} busy={busy} />}

      <section className="mt-12">
        <SectionTitle kicker="Directory" title={`${filtered.length} professional contact${filtered.length === 1 ? "" : "s"}`} />
        <div className="mb-5 grid grid-cols-2 gap-2.5 md:grid-cols-4 lg:grid-cols-7">
          <FilterSelect label="Destination" value={f.destination} onChange={(v) => setF({ ...f, destination: v })} options={dests} />
          <FilterSelect label="Tourism board" value={f.board} onChange={(v) => setF({ ...f, board: v })} options={boards} />
          <div>
            <Label htmlFor="f-role" className="!text-[12px] !text-muted">
              Role
            </Label>
            <Input id="f-role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} placeholder="e.g. marketing" className="h-9" />
          </div>
          <FilterSelect label="India office" value={f.office === "any" ? "" : f.office} onChange={(v) => setF({ ...f, office: v || "any" })} options={["yes"]} labels={{ yes: "Has India office" }} />
          <FilterSelect label="Representation agency" value={f.agency === "any" ? "" : f.agency} onChange={(v) => setF({ ...f, agency: v || "any" })} options={["yes"]} labels={{ yes: "Via agency" }} />
          <FilterSelect label="Verification" value={f.status} onChange={(v) => setF({ ...f, status: v })} options={STATUSES} />
          <FilterSelect
            label="Last verified"
            value={f.verified === "any" ? "" : f.verified}
            onChange={(v) => setF({ ...f, verified: v || "any" })}
            options={["30", "90", "stale"]}
            labels={{ "30": "Last 30 days", "90": "Last 90 days", stale: "Over 90 days ago" }}
          />
        </div>
        {contacts.length === 0 ? (
          <EmptyState icon={<Users className="h-8 w-8" />} title="The right connection is still out there." body="Search a destination or tourism board to start building a verified directory." />
        ) : filtered.length === 0 ? (
          <EmptyState title="No contacts match these filters." action={<Button variant="secondary" onClick={() => setF({ destination: "", board: "", role: "", office: "any", agency: "any", status: "", verified: "any" })}>Clear filters</Button>} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c) => (
              <ContactCard key={c.id} contact={c} saved={savedIds.includes(c.id)} />
            ))}
          </div>
        )}
      </section>

      {recentSearches.length > 0 && (
        <section className="mt-12">
          <SectionTitle kicker="History" title="Recent searches" />
          <ul className="divide-y divide-line rounded-[14px] border border-line bg-surface">
            {recentSearches.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <button className="truncate text-left font-medium text-ink hover:text-accent" onClick={() => setQuery(s.query)}>
                  {s.query}
                </button>
                <span className="shrink-0 text-[12px] text-muted">
                  {s.status === "completed" ? `${s.contact_ids.length} found` : s.status} · {timeAgo(s.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, labels }: { label: string; value: string; onChange: (v: string) => void; options: string[]; labels?: Record<string, string> }) {
  const id = `f-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div>
      <Label htmlFor={id} className="!text-[12px] !text-muted">
        {label}
      </Label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-9">
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {labels?.[o] ?? o}
          </option>
        ))}
      </Select>
    </div>
  );
}

const STEPS = ["queued", "finding_sources", "extracting_facts", "verifying", "completed"];
const STEP_LABEL: Record<string, string> = { queued: "Job created", finding_sources: "Finding sources", extracting_facts: "Extracting contacts", verifying: "Verifying", completed: "Completed" };

function SearchPanel({ state, savedIds, onRerun, busy }: { state: SearchState; savedIds: string[]; onRerun: () => void; busy: boolean }) {
  const { search, job, contacts } = state;
  const running = search.status === "running";
  const current = job?.status ?? "queued";
  return (
    <Card className="mt-6 p-5 md:p-6" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Search</p>
          <h2 className="mt-1 text-[19px] font-semibold text-ink">“{search.query}”</h2>
          {search.organisation && <p className="text-sm text-muted">Organisation: {search.organisation}</p>}
          {state.reused && <p className="mt-1 text-[12px] text-muted">Showing a search from {timeAgo(search.created_at)} to avoid repeating paid research.</p>}
        </div>
        {!running && (
          <Button variant="secondary" size="sm" onClick={onRerun} loading={busy}>
            <RotateCw className="h-3.5 w-3.5" /> Search again
          </Button>
        )}
      </div>

      {running && (
        <div className="mt-5">
          <ol className="flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
            {STEPS.map((s) => {
              const idx = STEPS.indexOf(current);
              const me = STEPS.indexOf(s);
              return (
                <li key={s} className={me < idx ? "text-mint-ink" : me === idx ? "font-medium text-ink" : "text-muted"}>
                  {me < idx ? <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> : me === idx ? <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> : null}
                  {STEP_LABEL[s]}
                </li>
              );
            })}
          </ol>
          {job?.log.length ? <p className="mt-3 text-[13px] text-muted">{job.log[job.log.length - 1].message}</p> : null}
        </div>
      )}

      {search.status === "failed" && (
        <Notice tone="danger" title="The search failed">
          {search.error ?? job?.error ?? "Unknown error."} Try again in a moment.
        </Notice>
      )}

      {search.status === "completed" && (
        <div className="mt-5 space-y-5">
          {search.notes.length > 0 && (
            <ul className="space-y-1.5 text-[13px] text-ink/80">
              {search.notes.map((n, i) => (
                <li key={i} className="flex gap-2">
                  {/not found|discarded|outdated|not itself been verified|failed|unavailable|ambiguous/i.test(n) ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-peach-ink" /> : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint-ink" />}
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          )}
          {contacts.length === 0 ? (
            <EmptyState title="The right connection is still out there." body="No reliable, verifiable contact was identified. Status: Not Found. Try the board's name, its India office city, or its representation agency." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {contacts.map((c) => (
                <ContactCard key={c.id} contact={c} saved={savedIds.includes(c.id)} />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
