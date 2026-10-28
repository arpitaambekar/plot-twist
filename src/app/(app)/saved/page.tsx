import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import type { SavedType } from "@/lib/types";
import { PageHeader } from "@/components/ui/primitives";
import { SavedList, type SavedRow } from "@/components/library/saved-list";

export const metadata = { title: "Saved" };

/** Resolve each bookmark to its current title and canonical link; removed items fall back to the stored label. */
async function resolve(type: SavedType, id: string, label: string): Promise<Omit<SavedRow, "id" | "type" | "saved_at">> {
  const s = db();
  switch (type) {
    case "news": {
      const n = await s.get("news_articles", id);
      return { title: n?.title ?? label, subtitle: n ? `${n.source_name} · ${n.category}` : null, href: `/home?story=${encodeURIComponent(id)}`, missing: !n };
    }
    case "report": {
      const r = await s.get("reports", id);
      return { title: r ? `${r.destination_name} research report` : label, subtitle: r ? `Version ${r.version} · ${r.status}` : null, href: `/research/${encodeURIComponent(id)}`, missing: !r };
    }
    case "idea": {
      const i = await s.get("campaign_ideas", id);
      return { title: i?.content.name ?? label, subtitle: i ? `${i.destination} · ${i.status}` : null, href: i ? `/studio/${encodeURIComponent(i.set_id)}?idea=${encodeURIComponent(id)}` : null, missing: !i };
    }
    case "contact": {
      const c = await s.get("contacts", id);
      return { title: c?.full_name ?? label, subtitle: c ? `${c.job_title}, ${c.organisation} · ${c.status}` : null, href: `/contacts/${encodeURIComponent(id)}`, missing: !c };
    }
    case "reference": {
      const r = await s.get("reference_campaigns", id);
      return { title: r?.name ?? label, subtitle: r ? `${r.tourism_board} · ${r.launch_date ?? "date not stated"}` : null, href: `/library?ref=${encodeURIComponent(id)}`, missing: !r };
    }
    case "pitch": {
      const p = await s.get("pitches", id);
      const idea = p ? await s.get("campaign_ideas", p.idea_id) : null;
      return {
        title: p?.title ?? label,
        subtitle: p ? `${p.destination} · pitch v${p.version}` : null,
        href: p && idea ? `/studio/${encodeURIComponent(idea.set_id)}?idea=${encodeURIComponent(idea.id)}&pitch=${encodeURIComponent(p.id)}` : null,
        missing: !p,
      };
    }
    case "opportunity": {
      const o = await s.get("opportunities", id);
      return { title: o?.name ?? label, subtitle: o ? `${o.destination} · ${o.stage}` : null, href: `/opportunities/${encodeURIComponent(id)}`, missing: !o };
    }
  }
}

export default async function SavedPage() {
  const user = (await getCurrentUser())!;
  const items = await db().list("saved_items", { where: { user_id: user.id } as never, orderBy: { column: "created_at" } });
  const rows: SavedRow[] = await Promise.all(items.map(async (i) => ({ id: i.item_id, type: i.item_type, saved_at: i.created_at, ...(await resolve(i.item_type, i.item_id, i.label || "Untitled item")) })));
  return (
    <div>
      <PageHeader eyebrow="Your shelf" title="Saved" subtitle="Research, ideas, people and stories you've kept for later." />
      <SavedList rows={rows} />
    </div>
  );
}
