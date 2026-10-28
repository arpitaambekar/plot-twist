import { route, parseBody } from "@/lib/api";
import { db } from "@/lib/db";
import { startResearch, StartSchema } from "@/lib/research/service";

/** List reports (summary fields), optionally filtered by destination. */
export const GET = route("viewer", async ({ req }) => {
  const dest = new URL(req.url).searchParams.get("destination")?.toLowerCase();
  const reports = await db().list("reports", { orderBy: { column: "updated_at" }, limit: 300 });
  const items = reports
    .filter((r) => !dest || r.destination_name.toLowerCase() === dest)
    .map((r) => ({
      id: r.id,
      destination_name: r.destination_name,
      query: r.query,
      options: r.options,
      version: r.version,
      status: r.status,
      health: r.health,
      hero_image: r.content?.snapshot.hero_image ?? null,
      updated_at: r.updated_at,
      created_at: r.created_at,
      is_demo: r.is_demo,
    }));
  return { items };
});

/** Start research (or return a cached/in-progress report for the same destination and options). */
export const POST = route("editor", async ({ user, req }) => {
  const body = await parseBody(req, StartSchema);
  return startResearch(user, body);
});
