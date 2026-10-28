import { route } from "@/lib/api";
import { db } from "@/lib/db";

/** Destination directory and autocomplete. */
export const GET = route("viewer", async ({ req }) => {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().toLowerCase();
  const all = await db().list("destinations", { orderBy: { column: "name", ascending: true } });
  const items = q ? all.filter((d) => d.name.toLowerCase().includes(q) || (d.tourism_board ?? "").toLowerCase().includes(q) || d.continent.toLowerCase().includes(q)) : all;
  return { items };
});
