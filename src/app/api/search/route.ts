import { route } from "@/lib/api";
import { db } from "@/lib/db";

export interface SearchHit {
  type: "Destination" | "News" | "Report" | "Campaign" | "Contact" | "Opportunity" | "Library";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export const GET = route("viewer", async ({ req }) => {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return { hits: [] };
  const s = db();
  const [dest, news, reports, ideas, contacts, opps, refs] = await Promise.all([
    s.search("destinations", ["name", "tourism_board", "continent"], q, 5),
    s.search("news_articles", ["title", "summary", "source_name"], q, 6),
    s.search("reports", ["destination_name", "query"], q, 5),
    s.search("campaign_ideas", ["destination"], q, 20),
    s.search("contacts", ["full_name", "organisation", "destination", "job_title"], q, 5),
    s.search("opportunities", ["name", "destination", "tourism_board", "summary"], q, 5),
    s.search("reference_campaigns", ["name", "tourism_board", "destination"], q, 5),
  ]);
  // Campaign names live inside jsonb content, so match them here as well.
  const allIdeas = ideas.length ? ideas : (await s.list("campaign_ideas", { limit: 400, orderBy: { column: "updated_at" } })).filter((i) => `${i.content.name} ${i.content.line}`.toLowerCase().includes(q.toLowerCase()));
  const hits: SearchHit[] = [
    ...dest.map((d) => ({ type: "Destination" as const, id: d.id, title: d.name, subtitle: d.tourism_board ?? d.continent, href: `/research?destination=${encodeURIComponent(d.name)}` })),
    ...reports.map((r) => ({ type: "Report" as const, id: r.id, title: `${r.destination_name} report`, subtitle: `v${r.version} · ${r.status}`, href: `/research/${r.id}` })),
    ...news.map((n) => ({ type: "News" as const, id: n.id, title: n.title, subtitle: n.source_name, href: `/home?story=${n.id}` })),
    ...allIdeas.slice(0, 6).map((i) => ({ type: "Campaign" as const, id: i.id, title: i.content.name, subtitle: `${i.destination} · ${i.status}`, href: `/studio/${i.set_id}?idea=${i.id}` })),
    ...contacts.map((c) => ({ type: "Contact" as const, id: c.id, title: c.full_name, subtitle: `${c.job_title}, ${c.organisation}`, href: `/contacts/${c.id}` })),
    ...opps.map((o) => ({ type: "Opportunity" as const, id: o.id, title: o.name, subtitle: `${o.destination} · ${o.stage}`, href: `/opportunities/${o.id}` })),
    ...refs.map((r) => ({ type: "Library" as const, id: r.id, title: r.name, subtitle: r.tourism_board, href: `/library?ref=${r.id}` })),
  ];
  return { hits };
});
