import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { ContactProfile } from "@/components/contacts/contact-profile";

export const metadata = { title: "Contact" };

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await getCurrentUser())!;
  const contact = await db().get("contacts", id);
  if (!contact) notFound();
  const dest = contact.destination.toLowerCase();
  const [history, reports, news, opps, saved, destination] = await Promise.all([
    db().list("verification_events", { where: { subject_type: "contact", subject_id: id } as never, orderBy: { column: "created_at" } }),
    db().list("reports", { orderBy: { column: "updated_at" }, limit: 300 }),
    db().list("news_articles", { orderBy: { column: "published_at" }, limit: 500 }),
    db().list("opportunities", { orderBy: { column: "updated_at" } }),
    db().list("saved_items", { where: { user_id: user.id, item_type: "contact", item_id: id } as never, limit: 1 }),
    db().list("destinations", { limit: 500 }).then((d) => d.find((x) => x.name.toLowerCase() === dest) ?? null),
  ]);
  return (
    <ContactProfile
      contact={contact}
      history={history}
      reports={reports.filter((r) => r.destination_name.toLowerCase() === dest).slice(0, 5).map((r) => ({ id: r.id, title: `${r.destination_name} report v${r.version}`, meta: r.status, date: r.updated_at }))}
      news={news
        .filter((n) => n.destinations.some((d) => d.toLowerCase() === dest) || (n.tourism_board && n.tourism_board.toLowerCase() === contact.organisation.toLowerCase()))
        .slice(0, 6)
        .map((n) => ({ id: n.id, title: n.title, meta: n.source_name, date: n.published_at, url: n.url }))}
      opportunities={opps.map((o) => ({ id: o.id, name: o.name, destination: o.destination, stage: o.stage, linked: o.contact_ids.includes(id) }))}
      saved={saved.length > 0}
      board={destination ? { name: destination.tourism_board, website: destination.board_website, india_page: destination.india_page, verified: destination.board_verified } : null}
    />
  );
}
