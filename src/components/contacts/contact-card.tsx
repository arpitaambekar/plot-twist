"use client";
import Link from "next/link";
import { useState } from "react";
import { ExternalLink, Mail, Phone, Globe, Linkedin, FileText } from "lucide-react";
import type { Contact } from "@/lib/types";
import { Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { ContactStatusBadge, DemoBadge } from "@/components/sources/status-badge";
import { SaveButton } from "@/components/shared/save-button";
import { AddToOpportunity } from "@/components/shared/add-to-opportunity";
import { fmtDate } from "@/lib/utils";

export function contactRoute(c: Contact): { label: string; href: string; Icon: typeof Mail } | null {
  if (c.email) return { label: c.email, href: `mailto:${c.email}`, Icon: Mail };
  if (c.phone) return { label: c.phone, href: `tel:${c.phone.replace(/[^\d+]/g, "")}`, Icon: Phone };
  if (c.linkedin) return { label: "LinkedIn profile", href: c.linkedin, Icon: Linkedin };
  if (c.website) return { label: "Official website", href: c.website, Icon: Globe };
  return null;
}

export function ContactSources({ contact, open, onOpenChange }: { contact: Contact; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`Sources for ${contact.full_name}`} subtitle={`Last verified ${fmtDate(contact.last_verified_at)}`}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <ContactStatusBadge status={contact.status} />
        </div>
        <p className="text-sm text-ink/80">{contact.verification_reason}</p>
        {contact.sources.length === 0 && <p className="text-sm text-muted">No sources stored.</p>}
        {contact.sources.map((s) => (
          <div key={s.url} className="rounded-xl border border-line bg-ivory/60 p-3.5">
            <p className="text-[12px] font-medium text-muted">
              {s.publisher} · {s.is_official ? "official source" : "third-party source"}
            </p>
            <p className="mt-1 text-sm font-medium text-ink">{s.title}</p>
            {s.quote && <blockquote className="mt-2 border-l-2 border-mint-ink/50 pl-3 text-[13px] italic text-ink/75">“{s.quote}”</blockquote>}
            <div className="mt-2 flex items-center justify-between text-[12px] text-muted">
              <span>Retrieved {fmtDate(s.retrieved_at)}</span>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
                Open source <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        ))}
        <p className="text-[12px] text-muted">External text is shown as evidence only. An India representative does not necessarily approve campaign budgets.</p>
      </div>
    </Sheet>
  );
}

export function ContactCard({ contact, saved }: { contact: Contact; saved: boolean }) {
  const [open, setOpen] = useState(false);
  const r = contactRoute(contact);
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/contacts/${contact.id}`} className="text-[17px] font-semibold leading-snug text-ink hover:text-accent">
            {contact.full_name}
          </Link>
          <p className="mt-0.5 text-sm text-ink/80">{contact.job_title}</p>
          <p className="text-[13px] text-muted">
            {contact.organisation} · {contact.destination}
          </p>
        </div>
        <SaveButton type="contact" id={contact.id} label={contact.full_name} initial={saved} className="border border-line" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ContactStatusBadge status={contact.status} />
        {contact.is_demo && <DemoBadge />}
        <span className="text-[12px] text-muted">Checked {fmtDate(contact.last_verified_at)}</span>
      </div>
      <div className="mt-3 text-[13px] text-ink/80">
        {r ? (
          <a href={r.href} target={r.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1.5 truncate text-accent hover:underline">
            <r.Icon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{r.label}</span>
          </a>
        ) : (
          <span className="text-muted">No published contact route</span>
        )}
        {(contact.india_office || contact.agency) && <p className="mt-1 truncate text-[12px] text-muted">{[contact.india_office && `India office: ${contact.india_office}`, contact.agency && `Agency: ${contact.agency}`].filter(Boolean).join(" · ")}</p>}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          <FileText className="h-3.5 w-3.5" /> Sources ({contact.sources.length})
        </Button>
        <AddToOpportunity
          size="sm"
          variant="ghost"
          label="Add to opportunity"
          className="!px-2"
          defaults={{ name: `${contact.destination} partnership`, destination: contact.destination, tourism_board: contact.organisation }}
          links={{ contact_ids: [contact.id] }}
        />
      </div>
      <ContactSources contact={contact} open={open} onOpenChange={setOpen} />
    </Card>
  );
}
