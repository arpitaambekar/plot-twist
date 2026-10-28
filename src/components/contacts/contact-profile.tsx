"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, ExternalLink, Mail, RotateCw, ShieldCheck } from "lucide-react";
import type { Contact, VerificationEvent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge, Card, Label, Notice, Select, Textarea } from "@/components/ui/primitives";
import { ContactStatusBadge, DemoBadge } from "@/components/sources/status-badge";
import { SaveButton } from "@/components/shared/save-button";
import { AddToOpportunity } from "@/components/shared/add-to-opportunity";
import { useSession } from "@/components/shell/user-context";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import { ContactSources, contactRoute } from "./contact-card";

interface Related {
  id: string;
  title: string;
  meta: string;
  date: string | null;
  url?: string;
}
interface Draft {
  subject: string;
  body: string;
  facts_used: string[];
  caution: string | null;
}

export function ContactProfile({
  contact: initial,
  history,
  reports,
  news,
  opportunities,
  saved,
  board,
}: {
  contact: Contact;
  history: VerificationEvent[];
  reports: Related[];
  news: Related[];
  opportunities: { id: string; name: string; destination: string; stage: string; linked: boolean }[];
  saved: boolean;
  board: { name: string | null; website: string | null; india_page: string | null; verified: boolean } | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const { can } = useSession();
  const [contact, setContact] = useState(initial);
  const [notes, setNotes] = useState(initial.notes);
  const [savingNotes, setSavingNotes] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const linked = opportunities.filter((o) => o.linked);
  const [oppId, setOppId] = useState(linked[0]?.id ?? "");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftMode, setDraftMode] = useState<"ai" | "template" | null>(null);
  const [drafting, setDrafting] = useState(false);
  const route = contactRoute(contact);

  async function reverify() {
    setVerifying(true);
    try {
      const r = await api<{ contact: Contact }>(`/api/contacts/${contact.id}/reverify`, { method: "POST" });
      setContact(r.contact);
      toast(`Re-verified: ${r.contact.status}.`);
      router.refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setVerifying(false);
    }
  }

  async function saveNotes() {
    setSavingNotes(true);
    try {
      await api(`/api/contacts/${contact.id}`, { method: "PATCH", json: { notes } });
      toast("Notes saved.");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSavingNotes(false);
    }
  }

  async function draftEmail() {
    setDrafting(true);
    try {
      const r = await api<{ draft: Draft; mode: "ai" | "template" }>(`/api/contacts/${contact.id}/outreach`, { json: { opportunity_id: oppId || null } });
      setDraft(r.draft);
      setDraftMode(r.mode);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setDrafting(false);
    }
  }

  return (
    <div>
      <Link href="/contacts" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> All contacts
      </Link>

      <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">
            {contact.organisation} · {contact.destination}
          </p>
          <h1 className="mt-2 text-[34px] font-semibold leading-tight tracking-[-0.02em] text-ink">{contact.full_name}</h1>
          <p className="mt-1 text-[16px] text-ink/80">{contact.job_title}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ContactStatusBadge status={contact.status} />
            {contact.is_demo && <DemoBadge />}
            <span className="text-[13px] text-muted">Last verified {fmtDate(contact.last_verified_at)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <SaveButton type="contact" id={contact.id} label={contact.full_name} initial={saved} variant="button" />
          {can("editor") && (
            <Button variant="secondary" onClick={reverify} loading={verifying}>
              <RotateCw className="h-4 w-4" /> Re-verify
            </Button>
          )}
          <AddToOpportunity defaults={{ name: `${contact.destination} partnership`, destination: contact.destination, tourism_board: contact.organisation }} links={{ contact_ids: [contact.id] }} />
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-[17px] font-semibold">Professional information</h2>
            <dl className="mt-4 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
              <Field label="Role">{contact.job_title}</Field>
              <Field label="Organisation">{contact.organisation}</Field>
              <Field label="Responsibility">{contact.responsibility || "Not stated in sources"}</Field>
              <Field label="India-market relevance">{contact.india_relevance || "Not stated in sources"}</Field>
              <Field label="India office">{contact.india_office ?? "Not identified"}</Field>
              <Field label="Representation agency">{contact.agency ?? "Not identified"}</Field>
            </dl>
            <p className="mt-5 rounded-xl bg-soft-peach px-3.5 py-2.5 text-[13px] text-peach-ink">
              An India representative is not necessarily the person who approves campaign budgets. Confirm the decision-maker during outreach.
            </p>
          </Card>

          <Card className="p-6">
            <h2 className="text-[17px] font-semibold">Published professional contact details</h2>
            <p className="mt-1 text-[13px] text-muted">Shown only when printed in a cited source. Nothing here is guessed.</p>
            <dl className="mt-4 grid gap-y-3 text-sm sm:grid-cols-2">
              <Field label="Email">{contact.email ? <a className="text-accent hover:underline" href={`mailto:${contact.email}`}>{contact.email}</a> : "Not published"}</Field>
              <Field label="Phone">{contact.phone ?? "Not published"}</Field>
              <Field label="LinkedIn">
                {contact.linkedin ? (
                  <a className="inline-flex items-center gap-1 text-accent hover:underline" href={contact.linkedin} target="_blank" rel="noopener noreferrer">
                    Public profile <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  "Not verified"
                )}
              </Field>
              <Field label="Official website">
                {contact.website ? (
                  <a className="inline-flex items-center gap-1 text-accent hover:underline" href={contact.website} target="_blank" rel="noopener noreferrer">
                    {contact.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")} <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  "Not recorded"
                )}
              </Field>
            </dl>
            <p className="mt-4 text-[13px] text-ink/70">Best route: {route ? route.label : "No published route yet."}</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[17px] font-semibold">Verification</h2>
              <Button size="sm" variant="secondary" onClick={() => setSourcesOpen(true)}>
                View sources ({contact.sources.length})
              </Button>
            </div>
            <p className="mt-2 text-sm text-ink/80">{contact.verification_reason}</p>
            <h3 className="mt-5 text-[13px] font-medium text-muted">History</h3>
            <ol className="mt-2 space-y-3 border-l border-line pl-4">
              {history.length === 0 && <li className="text-sm text-muted">No verification events recorded.</li>}
              {[...history].reverse().map((h) => (
                <li key={h.id} className="relative text-sm">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-accent" />
                  <p className="text-ink">
                    <span className="font-medium">{h.status}</span> · {h.note}
                  </p>
                  <p className="text-[12px] text-muted">
                    {fmtDateTime(h.created_at)} · {h.actor}
                  </p>
                </li>
              ))}
            </ol>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-accent" />
              <h2 className="text-[17px] font-semibold">Draft outreach email</h2>
            </div>
            <p className="mt-1 text-[13px] text-muted">A short introduction using only verified facts and the chosen opportunity. It is never sent from plot twist: copy it into your email client.</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Label htmlFor="opp-pick">Opportunity</Label>
                <Select id="opp-pick" value={oppId} onChange={(e) => setOppId(e.target.value)}>
                  <option value="">No opportunity (general introduction)</option>
                  {opportunities.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.linked ? "★ " : ""}
                      {o.name} · {o.destination}
                    </option>
                  ))}
                </Select>
              </div>
              <Button onClick={draftEmail} loading={drafting} disabled={!can("editor")}>
                Draft email
              </Button>
            </div>
            {contact.status === "Needs Verification" && (
              <div className="mt-3">
                <Notice tone="peach">This contact still needs verification. Re-verify before sending anything.</Notice>
              </div>
            )}
            {draft && (
              <div className="mt-5 space-y-3">
                {draftMode === "template" && <p className="text-[12px] text-muted">AI isn&apos;t configured, so this is a fact-only template.</p>}
                <div>
                  <Label htmlFor="d-subject">Subject</Label>
                  <input id="d-subject" className="h-10 w-full rounded-xl border border-line px-3.5 text-sm" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="d-body">Body</Label>
                  <Textarea id="d-body" rows={12} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[12px] text-muted">Facts used: {draft.facts_used.join("; ")}</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
                        toast("Copied. Nothing has been sent.");
                      } catch {
                        toast("Couldn't access the clipboard. Select the text and copy it.", "error");
                      }
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </Button>
                </div>
                {draft.caution && <Notice tone="peach">{draft.caution}</Notice>}
              </div>
            )}
          </Card>
        </div>

        <aside className="space-y-6">
          {board && (
            <Card className="p-5">
              <h2 className="text-[15px] font-semibold">Organisation</h2>
              <p className="mt-2 text-sm text-ink">{board.name ?? contact.organisation}</p>
              {board.website && (
                <a href={board.website} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[13px] text-accent hover:underline">
                  Official website <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {board.india_page && (
                <a href={board.india_page} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1 text-[13px] text-accent hover:underline">
                  India market page <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <p className="mt-2 text-[12px] text-muted">{board.verified ? <><ShieldCheck className="mr-1 inline h-3 w-3" />Directory entry verified</> : "Directory entry not yet verified"}</p>
            </Card>
          )}
          <Card className="p-5">
            <h2 className="text-[15px] font-semibold">Internal notes</h2>
            <Textarea className="mt-3" rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Context for the team. Never paste personal data." disabled={!can("editor")} />
            {can("editor") && (
              <Button size="sm" className="mt-2" onClick={saveNotes} loading={savingNotes} disabled={notes === contact.notes && !savingNotes && notes === initial.notes}>
                Save notes
              </Button>
            )}
          </Card>
          <RelatedList title="Associated opportunities" empty="Not linked to an opportunity yet." items={linked.map((o) => ({ id: o.id, title: o.name, meta: o.stage, date: null }))} href={(i) => `/opportunities/${i.id}`} />
          <RelatedList title="Related destination reports" empty={`No ${contact.destination} report yet.`} items={reports} href={(i) => `/research/${i.id}`} />
          <RelatedList title="Related news" empty="No related news stored." items={news} href={(i) => `/home?story=${i.id}`} />
        </aside>
      </div>
      <ContactSources contact={contact} open={sourcesOpen} onOpenChange={setSourcesOpen} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="mt-0.5 text-ink">{children}</dd>
    </div>
  );
}

function RelatedList({ title, items, empty, href }: { title: string; items: Related[]; empty: string; href: (i: Related) => string }) {
  return (
    <Card className="p-5">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2.5">
          {items.map((i) => (
            <li key={i.id}>
              <Link href={href(i)} className="block text-sm font-medium leading-snug text-ink hover:text-accent">
                {i.title}
              </Link>
              <p className="text-[12px] text-muted">
                <Badge className="!px-1.5 !py-0 !text-[11px]">{i.meta}</Badge> {i.date ? fmtDate(i.date) : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
