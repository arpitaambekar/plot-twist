import { route } from "@/lib/api";
import { db } from "@/lib/db";

export const GET = route("viewer", async ({ req }) => {
  const sp = new URL(req.url).searchParams;
  const destination = sp.get("destination");
  let items = await db().list("contacts", { orderBy: { column: "updated_at" }, limit: 1000 });
  if (destination) items = items.filter((c) => c.destination.toLowerCase() === destination.toLowerCase());
  return { items };
});
