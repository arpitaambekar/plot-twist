import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { generateSignals } from "@/lib/news/ingest";
import { burstLimit } from "@/lib/security/rate-limit";

export const maxDuration = 300;

export const GET = route("viewer", async () => {
  const items = await db().list("opportunity_signals", { orderBy: { column: "created_at" } });
  return { items };
});

/** Regenerate AI-assisted opportunity signals from stored news. */
export const POST = route("editor", async ({ user }) => {
  burstLimit(`signals:${user.id}`, 3, 2);
  const items = await generateSignals(user.id);
  return { items };
});
