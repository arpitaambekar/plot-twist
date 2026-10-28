import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { findPhoto } from "@/lib/images";
import { SEED_RESEARCHED_AT } from "@/lib/seed";
import type { ImageRef } from "@/lib/types";
import { PageHeader } from "@/components/ui/primitives";
import { LibraryView } from "@/components/library/library-view";

export const metadata = { title: "Campaign Library" };

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const sp = await searchParams;
  const user = (await getCurrentUser())!;
  const [items, destinations, saved] = await Promise.all([
    db().list("reference_campaigns", { orderBy: { column: "launch_date" } }),
    db().list("destinations", { limit: 300 }),
    db().list("saved_items", { where: { user_id: user.id, item_type: "reference" } as never }),
  ]);

  // Destination photos (clearly labelled as such, never presented as campaign creative).
  const uniq = [...new Set(items.filter((i) => !i.image).map((i) => i.destination))];
  const photos = new Map<string, ImageRef | null>();
  await Promise.all(
    uniq.map(async (name) => {
      const d = destinations.find((x) => x.name.toLowerCase() === name.toLowerCase());
      const img = await Promise.race([findPhoto(d?.photo_query ?? `${name} landscape`, { file: d?.photo_file, alt: `${name} (destination photo)` }), new Promise<null>((r) => setTimeout(() => r(null), 6000))]);
      photos.set(name, img ? { ...img, is_destination_photo: true } : null);
    }),
  );
  const withImages = items.map((i) => ({ ...i, image: i.image ?? photos.get(i.destination) ?? null }));

  return (
    <div>
      <PageHeader eyebrow="The Plot Thickens" title="Great ideas have a backstory." subtitle="Explore the campaigns changing how the world travels." />
      <LibraryView items={withImages} savedIds={saved.map((s) => s.item_id)} initialRef={sp.ref ?? null} seedDate={SEED_RESEARCHED_AT} />
    </div>
  );
}
