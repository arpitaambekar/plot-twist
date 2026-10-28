"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, CircleDashed, ExternalLink, Link2, Trash2, X, XCircle } from "lucide-react";
import { STAGES, type OpportunityActivity, type Stage } from "@/lib/types";
import type { OpportunityBundle } from "@/lib/opportunities/load";
import type { ReadinessItem } from "@/lib/opportunities/readiness";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Badge, Card, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { ContactStatusBadge } from "@/components/sources/status-badge";
import { SaveButton } from "@/components/shared/save-button";
import { useSession } from "@/components/shell/user-context";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import { cn, fmtDate, fmtDateTime } from "@/lib/utils";
import { PriorityDot, ReadinessBadge, ReadinessBar } from "./readiness-badge";

type Opt = { id: string; label: string };

export function OpportunityWorkspace({
  bundle,
  activities,
  owners,
  options,
}: {
  bundle: OpportunityBundle;
  activities: OpportunityActivity[];
  owners: string[];
  options: { reports: Opt[]; ideas: Opt[]; contacts: Opt[]; news: Opt[] };
}) {
  const router = useRouter();
  const toast = useToast();
  const { can } = useSession();
  const editable = can("editor");
  const o = bundle.opportunity;
  const r = bundle.readiness;

  const initialForm = () => ({
    name: o.name,
    destination: o.destination,
    tourism_board: o.tourism_board ?? "",
    summary: o.summary,
    stage: o.stage,
    priority: o.priority,
    owner: o.owner ?? "",
    next_action: o.next_action ?? "",
    next_action_date: o.next_action_date ?? "",
    campaign_window: o.campaign_window ?? "",
    commercial_notes: o.commercial_notes ?? "",
    notes: o.notes,
  });
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm(initialForm()), [o.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm());

  async function save(patch?: Record<string, unknown>) {
    setSaving(true);
    try {
      const body = patch ?? {
        ...form,
        tourism_board: form.tourism_board || null,
        owner: form.owner || null,
        next_action: form.next_action || null,
        next_action_date: form.next_action_date || null,
        campaign_window: form.campaign_window || null,
        commercial_notes: form.commercial_notes || null,
      };
      await api(`/api/opportunities/${o.id}`, { method: "PATCH", json: body });
      toast("Saved.");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function link(body: Record<string, unknown>) {
    try {
      await api(`/api/opportunities/${o.id}/link`, { json: body });
      toast("Linked.");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }
  async function unlink(field: string, value: string) {
    try {
      await api(`/api/opportunities/${o.id}/unlink`, { json: { field, value } });
      toast("Link removed.", "info");
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  const [del, setDel] = useState(false);
  async function remove() {
    try {
      await api(`/api/opportunities/${o.id}`, { method: "DELETE" });
      toast("Opportunity deleted.", "info");
      router.push("/opportunities");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div>
      <Link href="/opportunities" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Opportunity Tracker
      </Link>

      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="eyebrow">
            {o.destination}
            {o.tourism_board ? ` · ${o.tourism_board}` : ""}
          </p>
          <h1 className="mt-2 text-[32px] font-semibold leading-tight tracking-[-0.02em] text-ink">{o.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <Badge tone="ink">{o.stage}</Badge>
            <span className="inline-flex items-center gap-1.5">
              <PriorityDot priority={o.priority} /> {o.priority} priority
            </span>
            <span>· Owner: {o.owner ?? "Unassigned"}</span>
            {o.last_interaction && <span>· Last interaction: {o.last_interaction}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <SaveButton type="opportunity" id={o.id} label={o.name} variant="button" />
          {editable && (
            <Select value={o.stage} onChange={(e) => save({ stage: e.target.value as Stage })} className="w-52" aria-label="Stage">
              {STAGES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          )}
        </div>
      </header>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <ReadinessPanel bundle={bundle} editable={editable} onSet={(key, v) => save({ manual_checks: { [key]: v } })} />

          <Card className="p-6" id="details">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-semibold">Details</h2>
              {editable && dirty && <span className="text-[12px] text-peach-ink">Unsaved changes</span>}
            </div>
            <fieldset disabled={!editable} className="mt-4 grid gap-4 sm:grid-cols-2">
              <F label="Opportunity name" id="d-name">
                <Input id="d-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </F>
              <F label="Tourism board" id="d-board">
                <Input id="d-board" value={form.tourism_board} onChange={(e) => setForm({ ...form, tourism_board: e.target.value })} />
              </F>
              <F label="Destination" id="d-dest">
                <Input id="d-dest" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
              </F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Priority" id="d-pri">
                  <Select id="d-pri" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as typeof form.priority })}>
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </Select>
                </F>
                <F label="Internal owner" id="d-owner">
                  <Input id="d-owner" list="d-owner-list" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} placeholder="Unassigned" />
                  <datalist id="d-owner-list">
                    {owners.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                </F>
              </div>
              <div className="sm:col-span-2">
                <F label="Opportunity summary" id="d-sum">
                  <Textarea id="d-sum" rows={3} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
                </F>
              </div>
              <F label="Next action" id="d-next">
                <Input id="d-next" value={form.next_action} onChange={(e) => setForm({ ...form, next_action: e.target.value })} placeholder={r.next ? r.next.action?.label ?? r.next.label : ""} />
              </F>
              <F label="Next action date" id="d-next-date">
                <Input id="d-next-date" type="date" value={form.next_action_date} onChange={(e) => setForm({ ...form, next_action_date: e.target.value })} />
              </F>
              <F label="Campaign window" id="d-window">
                <Input id="d-window" value={form.campaign_window} onChange={(e) => setForm({ ...form, campaign_window: e.target.value })} placeholder="e.g. Oct to Dec 2027 (Indian winter break)" />
              </F>
              <F label="Budget or commercial details (when known)" id="d-comm">
                <Input id="d-comm" value={form.commercial_notes} onChange={(e) => setForm({ ...form, commercial_notes: e.target.value })} placeholder="Only what has actually been shared" />
              </F>
              <div className="sm:col-span-2">
                <F label="Notes" id="d-notes">
                  <Textarea id="d-notes" rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </F>
              </div>
            </fieldset>
            {editable && (
              <div className="mt-4 flex justify-end gap-2">
                {dirty && (
                  <Button variant="ghost" onClick={() => setForm(initialForm())}>
                    Discard
                  </Button>
                )}
                <Button onClick={() => save()} loading={saving} disabled={!dirty || form.name.trim().length < 2}>
                  Save details
                </Button>
              </div>
            )}
          </Card>

          <LinkedWork bundle={bundle} options={options} editable={editable} onLink={link} onUnlink={unlink} onShortlist={(id) => save({ shortlisted_idea_id: id })} />

          {editable && (
            <div className="flex justify-end">
              <Button variant="danger" size="sm" onClick={() => setDel(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete opportunity
              </Button>
              <Dialog
                open={del}
                onOpenChange={setDel}
                title="Delete this opportunity?"
                description="Linked research, campaigns and contacts are kept. Only the opportunity record and its activity log are removed."
                footer={
                  <>
                    <Button variant="secondary" onClick={() => setDel(false)}>
                      Cancel
                    </Button>
                    <Button variant="danger" onClick={remove}>
                      Delete
                    </Button>
                  </>
                }
              >
                <p className="text-sm">{o.name}</p>
              </Dialog>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <Activity oppId={o.id} activities={activities} editable={editable} />
        </aside>
      </div>
    </div>
  );
}

function F({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- readiness */

function ReadinessPanel({ bundle, editable, onSet }: { bundle: OpportunityBundle; editable: boolean; onSet: (key: string, v: boolean | null) => void }) {
  const r = bundle.readiness;
  return (
    <Card className="p-6" id="readiness">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow">Pitch readiness</p>
          <div className="mt-2 flex items-center gap-3">
            <ReadinessBadge status={r.status} />
            <span className="text-sm text-muted">
              {r.completed} of {r.total} criteria complete ({r.pct}%) · {r.not_assessed} not assessed
            </span>
          </div>
          <p className="mt-2 text-[13px] text-ink/75">{r.status_reason}</p>
        </div>
      </div>
      <ReadinessBar pct={r.pct} className="mt-4" />
      <ol className="mt-3 flex flex-wrap gap-x-1 gap-y-1 text-[11px]">
        {(["Research Needed", "Research Ready", "Outreach Ready", "Pitch in Development", "Pitch Ready"] as const).map((s, i, arr) => (
          <li key={s} className={cn("flex items-center gap-1", s === r.status ? "font-semibold text-accent" : "text-muted")}>
            {s}
            {i < arr.length - 1 && <ArrowRight className="h-3 w-3 text-muted/60" />}
          </li>
        ))}
      </ol>

      {r.next && (
        <div className="mt-5 flex flex-col gap-3 rounded-xl bg-soft-blue px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-accent">Recommended next step</p>
            <p className="mt-0.5 text-sm font-medium text-ink">{r.next.action?.label ?? r.next.label}</p>
            <p className="text-[12px] text-ink/70">{r.next.explanation}</p>
          </div>
          {r.next.action && !r.next.action.href.endsWith("#readiness") && (
            <Link href={r.next.action.href} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover">
              Go <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {r.groups.map((g) => {
          const done = g.items.filter((i) => i.state === "done").length;
          return (
            <section key={g.key}>
              <h3 className="flex items-center justify-between text-[14px] font-semibold text-ink">
                <span>
                  {g.key}. {g.title}
                </span>
                <span className="text-[12px] font-normal text-muted">
                  {done}/{g.items.length}
                </span>
              </h3>
              <ul className="mt-2 space-y-2.5">
                {g.items.map((i) => (
                  <Item key={i.key} item={i} editable={editable} onSet={onSet} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="mt-6 text-[12px] text-muted">
        Automatic checks read stored research, campaigns, contacts and news. Team checks stay “Not assessed” until someone answers them. Nothing is marked complete by default.
      </p>
    </Card>
  );
}

function Item({ item, editable, onSet }: { item: ReadinessItem; editable: boolean; onSet: (key: string, v: boolean | null) => void }) {
  const Icon = item.state === "done" ? CheckCircle2 : item.state === "missing" ? (item.kind === "manual" ? XCircle : Circle) : CircleDashed;
  const color = item.state === "done" ? "text-mint-ink" : item.state === "missing" ? "text-ink/40" : "text-peach-ink";
  return (
    <li className="flex gap-2.5">
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", color)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-ink">
          {item.label}
          <span className="ml-1.5 text-[11px] font-normal text-muted">{item.kind === "auto" ? "auto" : "team check"}</span>
          <span className="sr-only">: {item.state === "done" ? "complete" : item.state === "missing" ? "incomplete" : "not assessed"}</span>
        </p>
        <p className="text-[12px] text-muted">{item.explanation}</p>
        {item.kind === "auto" && item.action && item.state !== "done" && !item.action.href.includes("#") && (
          <Link href={item.action.href} className="text-[12px] font-medium text-accent hover:underline">
            {item.action.label}
          </Link>
        )}
        {item.kind === "manual" && editable && (
          <div className="mt-1.5 inline-flex rounded-full border border-line p-0.5 text-[11px]" role="radiogroup" aria-label={item.label}>
            {(
              [
                [true, "Yes"],
                [false, "Not yet"],
                [null, "Not assessed"],
              ] as const
            ).map(([v, l]) => {
              const active = (item.state === "done" && v === true) || (item.state === "missing" && v === false) || (item.state === "not_assessed" && v === null);
              return (
                <button key={l} role="radio" aria-checked={active} onClick={() => !active && onSet(item.key, v)} className={cn("rounded-full px-2.5 py-0.5", active ? "bg-ink text-white" : "text-ink/70 hover:text-ink")}>
                  {l}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </li>
  );
}

/* ---------------------------------------------------------------- linked work */

function LinkedWork({
  bundle,
  options,
  editable,
  onLink,
  onUnlink,
  onShortlist,
}: {
  bundle: OpportunityBundle;
  options: { reports: Opt[]; ideas: Opt[]; contacts: Opt[]; news: Opt[] };
  editable: boolean;
  onLink: (b: Record<string, unknown>) => void;
  onUnlink: (field: string, value: string) => void;
  onShortlist: (id: string | null) => void;
}) {
  const o = bundle.opportunity;
  const [src, setSrc] = useState({ title: "", url: "" });
  const reportStatus = bundle.report?.health ? `${bundle.report.health.evidence_pct}% evidenced` : bundle.report?.status;

  return (
    <Card className="p-6">
      <h2 className="text-[17px] font-semibold">Linked work and evidence</h2>
      <p className="mt-1 text-[13px] text-muted">Everything here stays connected to this opportunity.</p>

      <Group title="Research report" picker={editable && <Picker options={options.reports} placeholder="Link a report" onPick={(id) => onLink({ report_id: id })} />}>
        {bundle.report ? (
          <Row href={`/research/${bundle.report.id}`} title={`${bundle.report.destination_name} report v${bundle.report.version}`} meta={`${bundle.report.status}${reportStatus ? ` · ${reportStatus}` : ""}`} onRemove={editable ? () => onUnlink("report_id", bundle.report!.id) : undefined} />
        ) : o.report_id ? (
          <p className="text-[13px] text-muted">The linked report no longer exists.</p>
        ) : (
          <Empty>
            No report yet. <Link className="text-accent hover:underline" href={`/research?destination=${encodeURIComponent(o.destination)}`}>Research {o.destination}</Link>
          </Empty>
        )}
      </Group>

      <Group title="Campaign concepts" picker={editable && <Picker options={options.ideas.filter((i) => !o.idea_ids.includes(i.id))} placeholder="Link a campaign" onPick={(id) => onLink({ idea_ids: [id] })} />}>
        {bundle.ideas.length ? (
          bundle.ideas.map((i) => (
            <Row
              key={i.id}
              href={`/studio/${i.set_id}?idea=${i.id}`}
              title={i.content.name}
              meta={`${i.status}${o.shortlisted_idea_id === i.id ? " · chosen for this opportunity" : ""}`}
              extra={
                editable &&
                (o.shortlisted_idea_id === i.id ? (
                  <button className="text-[12px] text-muted hover:text-ink" onClick={() => onShortlist(null)}>
                    Unset as chosen
                  </button>
                ) : (
                  <button className="text-[12px] font-medium text-accent hover:underline" onClick={() => onShortlist(i.id)}>
                    Choose for pitch
                  </button>
                ))
              }
              onRemove={editable ? () => onUnlink("idea_ids", i.id) : undefined}
            />
          ))
        ) : (
          <Empty>
            No campaigns linked.{" "}
            <Link className="text-accent hover:underline" href={bundle.report ? `/studio?report=${bundle.report.id}` : "/studio"}>
              Open Campaign Studio
            </Link>
          </Empty>
        )}
        {bundle.ideas.some((i) => i.id === o.shortlisted_idea_id && i.status === "draft") && (
          <p className="mt-1 text-[12px] text-peach-ink">The chosen campaign is still a draft. Shortlist it in Campaign Studio to complete the readiness check.</p>
        )}
      </Group>

      <Group title="Pitch">
        {bundle.pitch ? (
          <Row href={`/studio/${bundle.ideas.find((i) => i.id === bundle.pitch!.idea_id)?.set_id ?? ""}?idea=${bundle.pitch.idea_id}`} title={bundle.pitch.title} meta={`v${bundle.pitch.version} · updated ${fmtDate(bundle.pitch.updated_at)}`} onRemove={editable ? () => onUnlink("pitch_id", bundle.pitch!.id) : undefined} />
        ) : (
          <Empty>No pitch yet. Develop the chosen campaign into a pitch in Campaign Studio.</Empty>
        )}
      </Group>

      <Group title="Contacts" picker={editable && <Picker options={options.contacts.filter((c) => !o.contact_ids.includes(c.id))} placeholder="Link a contact" onPick={(id) => onLink({ contact_ids: [id] })} />}>
        {bundle.contacts.length ? (
          bundle.contacts.map((c) => (
            <Row key={c.id} href={`/contacts/${c.id}`} title={c.full_name} meta={`${c.job_title}, ${c.organisation}`} extra={<ContactStatusBadge status={c.status} />} onRemove={editable ? () => onUnlink("contact_ids", c.id) : undefined} />
          ))
        ) : (
          <Empty>
            No contacts linked.{" "}
            <Link className="text-accent hover:underline" href={`/contacts?q=${encodeURIComponent(`${o.tourism_board ?? o.destination} India`)}&destination=${encodeURIComponent(o.destination)}`}>
              Find contacts
            </Link>
          </Empty>
        )}
      </Group>

      <Group title="Triggering news and evidence" picker={editable && <Picker options={options.news.filter((n) => !o.news_ids.includes(n.id))} placeholder="Link a news story" onPick={(id) => onLink({ news_ids: [id] })} />}>
        {bundle.news.length ? (
          bundle.news.map((n) => (
            <Row
              key={n.id}
              href={`/home?story=${n.id}`}
              title={n.title}
              meta={`${n.source_name} · ${fmtDate(n.published_at)} · India relevance ${n.india_relevance}`}
              extra={
                <a href={n.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline">
                  Source <ExternalLink className="h-3 w-3" />
                </a>
              }
              onRemove={editable ? () => onUnlink("news_ids", n.id) : undefined}
            />
          ))
        ) : (
          <Empty>No news linked.</Empty>
        )}
      </Group>

      <Group title="Source links">
        {o.source_links.length ? (
          o.source_links.map((l) => (
            <div key={l.url} className="flex items-center justify-between gap-3 py-1.5">
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1.5 text-sm text-accent hover:underline">
                <Link2 className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{l.title || l.url}</span>
              </a>
              {editable && (
                <button onClick={() => onUnlink("source_links", l.url)} className="rounded p-1 text-muted hover:text-danger" aria-label={`Remove ${l.title}`}>
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))
        ) : (
          <Empty>No saved links.</Empty>
        )}
        {editable && (
          <form
            className="mt-2 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              onLink({ source_links: [{ title: src.title || src.url, url: src.url }] });
              setSrc({ title: "", url: "" });
            }}
          >
            <Input value={src.title} onChange={(e) => setSrc({ ...src, title: e.target.value })} placeholder="Title" className="h-9 sm:w-48" aria-label="Link title" />
            <Input value={src.url} onChange={(e) => setSrc({ ...src, url: e.target.value })} placeholder="https://…" type="url" required className="h-9" aria-label="Link URL" />
            <Button size="sm" variant="secondary" type="submit" className="h-9">
              Add link
            </Button>
          </form>
        )}
      </Group>
    </Card>
  );
}

function Group({ title, picker, children }: { title: string; picker?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-5 border-t border-line pt-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-muted">{title}</h3>
        {picker}
      </div>
      {children}
    </section>
  );
}

function Row({ href, title, meta, extra, onRemove }: { href: string; title: string; meta: string; extra?: React.ReactNode; onRemove?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <Link href={href} className="block truncate text-sm font-medium text-ink hover:text-accent">
          {title}
        </Link>
        <p className="truncate text-[12px] text-muted">{meta}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {extra}
        {onRemove && (
          <button onClick={onRemove} className="rounded p-1 text-muted hover:text-danger" aria-label={`Unlink ${title}`} title="Unlink">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] text-muted">{children}</p>;
}

function Picker({ options, placeholder, onPick }: { options: Opt[]; placeholder: string; onPick: (id: string) => void }) {
  if (!options.length) return null;
  return (
    <Select
      value=""
      onChange={(e) => {
        if (e.target.value) onPick(e.target.value);
      }}
      className="h-8 w-60 text-[12px]"
      aria-label={placeholder}
    >
      <option value="">+ {placeholder}</option>
      {options.slice(0, 200).map((x) => (
        <option key={x.id} value={x.id}>
          {x.label.length > 90 ? x.label.slice(0, 88) + "…" : x.label}
        </option>
      ))}
    </Select>
  );
}

/* ---------------------------------------------------------------- activity */

function Activity({ oppId, activities, editable }: { oppId: string; activities: OpportunityActivity[]; editable: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [kind, setKind] = useState<"note" | "outreach_recorded" | "meeting_recorded">("note");
  const [body, setBody] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/api/opportunities/${oppId}/activities`, { json: { kind, body, date: kind === "note" ? undefined : date } });
      setBody("");
      toast(kind === "note" ? "Note added." : "Recorded.");
      router.refresh();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <h2 className="text-[15px] font-semibold">Activity</h2>
      {editable && (
        <form onSubmit={add} className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="h-9 text-[13px]" aria-label="Activity type">
              <option value="note">Note</option>
              <option value="outreach_recorded">Record outreach sent</option>
              <option value="meeting_recorded">Record meeting</option>
            </Select>
            {kind !== "note" && <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-[13px]" aria-label="Date" />}
          </div>
          <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder={kind === "note" ? "Add a note…" : "Who, how, and what was said"} required />
          {kind !== "note" && <p className="text-[11px] text-muted">This records that you did it. plot twist never sends email or contacts anyone.</p>}
          <Button size="sm" type="submit" loading={busy} disabled={!body.trim()}>
            Add
          </Button>
        </form>
      )}
      <ol className="mt-5 space-y-3.5 border-l border-line pl-4">
        {activities.length === 0 && <li className="text-[13px] text-muted">No activity yet.</li>}
        {[...activities].reverse().map((a) => (
          <li key={a.id} className="relative">
            <span className={cn("absolute -left-[21px] top-1.5 h-2 w-2 rounded-full", a.kind === "outreach_recorded" || a.kind === "meeting_recorded" ? "bg-mint-ink" : a.kind === "stage_change" ? "bg-accent" : "bg-ink/25")} />
            <p className="text-[13px] text-ink">{a.body}</p>
            <p className="text-[11px] text-muted">
              {a.author} · {fmtDateTime(a.created_at)}
            </p>
          </li>
        ))}
      </ol>
    </Card>
  );
}
