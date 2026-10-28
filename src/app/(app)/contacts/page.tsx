import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { ContactsView } from "@/components/contacts/contacts-view";

export const metadata = { title: "Tourism Board Contacts" };

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ q?: string; destination?: string }> }) {
  const sp = await searchParams;
  const user = (await getCurrentUser())!;
  const [contacts, destinations, searches, saved] = await Promise.all([
    db().list("contacts", { orderBy: { column: "updated_at" }, limit: 1000 }),
    db().list("destinations", { orderBy: { column: "name", ascending: true } }),
    db().list("contact_searches", { orderBy: { column: "created_at" }, limit: 8 }),
    db().list("saved_items", { where: { user_id: user.id, item_type: "contact" } as never }),
  ]);
  return (
    <ContactsView
      contacts={contacts}
      destinations={destinations.map((d) => ({ name: d.name, board: d.tourism_board }))}
      recentSearches={searches}
      savedIds={saved.map((s) => s.item_id)}
      initialQuery={sp.q?.slice(0, 160) ?? ""}
      initialDestination={sp.destination?.slice(0, 120) ?? ""}
    />
  );
}
