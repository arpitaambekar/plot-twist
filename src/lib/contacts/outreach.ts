import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { generateStructured } from "@/lib/ai/openai";
import type { Contact, Opportunity } from "@/lib/types";

export const OutreachDraft = z.object({
  subject: z.string().max(160),
  body: z.string().max(2500),
  facts_used: z.array(z.string().max(300)).max(10),
  caution: z.string().max(400).nullable(),
});
export type OutreachDraft = z.infer<typeof OutreachDraft>;

interface Facts {
  recipient: string;
  greetingName: string;
  role: string;
  organisation: string;
  destination: string;
  opportunity: { name: string; summary: string } | null;
  evidence: { title: string; url: string }[];
  sender: string;
}

async function gatherFacts(contact: Contact, opp: Opportunity | null, sender: string): Promise<Facts> {
  const evidence: { title: string; url: string }[] = [];
  if (opp?.news_ids.length) {
    const news = await db().list("news_articles", { in: { column: "id", values: opp.news_ids.slice(0, 5) } });
    evidence.push(...news.map((n) => ({ title: n.title, url: n.url })));
  }
  if (opp) evidence.push(...opp.source_links.slice(0, 3));
  return {
    recipient: contact.full_name,
    greetingName: contact.full_name.split(" ")[0],
    role: contact.job_title,
    organisation: contact.organisation,
    destination: contact.destination,
    opportunity: opp ? { name: opp.name, summary: opp.summary } : null,
    evidence: evidence.slice(0, 5),
    sender,
  };
}

/** Deterministic template used when AI is not configured: built only from stored, verified facts. */
function templateDraft(f: Facts): OutreachDraft {
  const evidenceLine = f.evidence[0] ? `\n\nI saw the recent news, "${f.evidence[0].title}", and it got us thinking about what we could build together for Indian travellers.` : "";
  const oppLine = f.opportunity?.summary ? `\n\nThe idea we'd like to explore: ${f.opportunity.summary.trim()}` : "";
  return {
    subject: `${f.destination} x Scapia: an idea for Indian travellers`,
    body:
      `Dear ${f.greetingName},\n\nI'm ${f.sender} from the marketing and tourism partnerships team at Scapia, an Indian travel platform. I'm reaching out because of your role as ${f.role} at ${f.organisation}.` +
      evidenceLine +
      oppLine +
      `\n\nWould you be open to a short call in the coming weeks to see whether there's a fit? Happy to share a brief note beforehand.\n\nBest regards,\n${f.sender}\nScapia`,
    facts_used: [`${f.recipient}, ${f.role}, ${f.organisation} (from verified contact record)`, ...f.evidence.slice(0, 1).map((e) => `News: ${e.title}`), ...(f.opportunity ? [`Opportunity: ${f.opportunity.name}`] : [])],
    caution: null,
  };
}

export async function draftOutreach(contact: Contact, opp: Opportunity | null, sender: { id: string; name: string }): Promise<{ draft: OutreachDraft; mode: "ai" | "template" }> {
  const f = await gatherFacts(contact, opp, sender.name);
  const caution =
    contact.status === "Needs Verification"
      ? "This contact still needs verification. Confirm their current role before sending."
      : "An India representative may not be the person who approves campaign budgets. Ask who the right decision-maker is.";
  if (!env.openaiKey && !env.demoFixtures) return { draft: { ...templateDraft(f), caution }, mode: "template" };

  const draft = await generateStructured({
    task: "contacts.outreach",
    schema: OutreachDraft,
    userId: sender.id,
    system: [
      "Draft a short, professional first-contact email (under 170 words) from the Scapia marketing and tourism partnerships team to a tourism-board professional.",
      "Use ONLY the facts provided. Do not claim any existing relationship, prior meeting, familiarity, mutual contact, agreement, budget, commitment or results. Do not invent statistics.",
      "Make the ask clear and low-pressure (a short call). Sound human and confident, no corporate fluff, no em dashes.",
      "List every fact you used in facts_used. Put any caveat for the sender in caution.",
    ].join("\n"),
    user: JSON.stringify(f),
    fixture: () => ({ ...templateDraft(f), caution: "Demo fixture draft." }),
    maxTokens: 2000,
  });
  return { draft: { ...draft, caution: [draft.caution, caution].filter(Boolean).join(" ") }, mode: "ai" };
}
