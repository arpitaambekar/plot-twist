import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { loadBundle } from "@/lib/opportunities/load";
import { OpportunityWorkspace } from "@/components/opportunities/opportunity-workspace";

export const metadata = { title: "Opportunity" };

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await db().get("opportunities", id);
  if (!o) notFound();
  const [bundle, activities, reports, ideas, contacts, news, profiles] = await Promise.all([
    loadBundle(o),
    db().list("opportunity_activities", { where: { opportunity_id: id } as never, orderBy: { column: "created_at" } }),
    db().list("reports", { orderBy: { column: "updated_at" }, limit: 300 }),
    db().list("campaign_ideas", { orderBy: { column: "updated_at" }, limit: 500 }),
    db().list("contacts", { orderBy: { column: "updated_at" }, limit: 1000 }),
    db().list("news_articles", { orderBy: { column: "published_at" }, limit: 300 }),
    db().list("profiles", { limit: 500 }),
  ]);
  const dest = o.destination.toLowerCase();
  // Same-destination items first, so linking is quick.
  const rank = (d: string) => (d.toLowerCase() === dest ? 0 : 1);
  return (
    <OpportunityWorkspace
      bundle={bundle}
      activities={activities}
      owners={[...new Set(profiles.map((p) => p.name))]}
      options={{
        reports: reports
          .filter((r) => r.status !== "failed")
          .sort((a, b) => rank(a.destination_name) - rank(b.destination_name))
          .map((r) => ({ id: r.id, label: `${r.destination_name} report v${r.version} (${r.status})` })),
        ideas: ideas.sort((a, b) => rank(a.destination) - rank(b.destination)).map((i) => ({ id: i.id, label: `${i.content.name} · ${i.destination} · ${i.status}` })),
        contacts: contacts.sort((a, b) => rank(a.destination) - rank(b.destination)).map((c) => ({ id: c.id, label: `${c.full_name}, ${c.job_title} (${c.status})` })),
        news: news.sort((a, b) => rank(a.destinations.find((d) => d.toLowerCase() === dest) ?? "") - rank(b.destinations.find((d) => d.toLowerCase() === dest) ?? "")).map((n) => ({ id: n.id, label: `${n.title} · ${n.source_name}` })),
      }}
    />
  );
}
