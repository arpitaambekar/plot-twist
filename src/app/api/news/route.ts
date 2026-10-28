import { route } from "@/lib/api";
import { db } from "@/lib/db";

/** News list with simple server-side filters (the Home page also filters client-side). */
export const GET = route("viewer", async ({ req }) => {
  const sp = new URL(req.url).searchParams;
  const days = Math.min(Number(sp.get("days") ?? 30) || 30, 365);
  const category = sp.get("category");
  const destination = sp.get("destination");
  const since = Date.now() - days * 86400000;
  let items = await db().list("news_articles", { orderBy: { column: "published_at" }, limit: 1000 });
  items = items.filter((n) => !n.published_at || new Date(n.published_at).getTime() >= since);
  if (category) items = items.filter((n) => n.category === category);
  if (destination) items = items.filter((n) => n.destinations.some((d) => d.toLowerCase() === destination.toLowerCase()));
  return { items: items.slice(0, 200) };
});
