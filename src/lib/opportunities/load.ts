import "server-only";
import { db } from "@/lib/db";
import type { CampaignIdea, CampaignSet, Contact, NewsArticle, Opportunity, Pitch, Report } from "@/lib/types";
import { computeReadiness, type Readiness } from "./readiness";

const byIds = async <T extends { id: string }>(table: "reports" | "campaign_ideas" | "campaign_sets" | "contacts" | "news_articles" | "pitches", ids: string[]): Promise<T[]> => {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return [];
  return (await db().list(table, { in: { column: "id", values: uniq } })) as unknown as T[];
};

export interface OpportunityBundle {
  opportunity: Opportunity;
  readiness: Readiness;
  report: Report | null;
  ideas: CampaignIdea[];
  sets: CampaignSet[];
  pitch: Pitch | null;
  contacts: Contact[];
  news: NewsArticle[];
}

export async function loadBundle(o: Opportunity, withClaims = true): Promise<OpportunityBundle> {
  const [reports, ideas, contacts, news, pitches] = await Promise.all([
    byIds<Report>("reports", o.report_id ? [o.report_id] : []),
    byIds<CampaignIdea>("campaign_ideas", [...o.idea_ids, ...(o.shortlisted_idea_id ? [o.shortlisted_idea_id] : [])]),
    byIds<Contact>("contacts", o.contact_ids),
    byIds<NewsArticle>("news_articles", o.news_ids),
    byIds<Pitch>("pitches", o.pitch_id ? [o.pitch_id] : []),
  ]);
  const sets = await byIds<CampaignSet>("campaign_sets", ideas.map((i) => i.set_id));
  const report = reports[0] ?? null;
  const reportClaims = withClaims && report ? await db().list("claims", { where: { subject_type: "report", subject_id: `${report.id}:v${report.version}` } as never }) : null;
  const pitch = pitches[0] ?? null;
  const readiness = computeReadiness(o, { report, reportClaims, ideas, sets, pitch, contacts, news });
  return { opportunity: o, readiness, report, ideas, sets, pitch, contacts, news };
}

/** Readiness for many opportunities with batched lookups (list/kanban views). */
export async function loadReadinessMap(opps: Opportunity[]): Promise<Record<string, Readiness>> {
  const [reports, ideas, contacts, news] = await Promise.all([
    byIds<Report>("reports", opps.map((o) => o.report_id ?? "")),
    byIds<CampaignIdea>("campaign_ideas", opps.flatMap((o) => [...o.idea_ids, o.shortlisted_idea_id ?? ""])),
    byIds<Contact>("contacts", opps.flatMap((o) => o.contact_ids)),
    byIds<NewsArticle>("news_articles", opps.flatMap((o) => o.news_ids)),
  ]);
  const sets = await byIds<CampaignSet>("campaign_sets", ideas.map((i) => i.set_id));
  const out: Record<string, Readiness> = {};
  for (const o of opps) {
    const myIdeas = ideas.filter((i) => o.idea_ids.includes(i.id) || i.id === o.shortlisted_idea_id);
    out[o.id] = computeReadiness(o, {
      report: reports.find((r) => r.id === o.report_id) ?? null,
      reportClaims: null,
      ideas: myIdeas,
      sets: sets.filter((s) => myIdeas.some((i) => i.set_id === s.id)),
      pitch: null,
      contacts: contacts.filter((c) => o.contact_ids.includes(c.id)),
      news: news.filter((n) => o.news_ids.includes(n.id)),
    });
  }
  return out;
}
