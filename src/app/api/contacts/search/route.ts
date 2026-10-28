import { z } from "zod";
import { route, parseBody } from "@/lib/api";
import { db, newId, nowIso } from "@/lib/db";
import { NotConfiguredError } from "@/lib/env";
import { createJob, runInBackground } from "@/lib/jobs";
import { searchConfigured } from "@/lib/search";
import { burstLimit, checkDailyLimit } from "@/lib/security/rate-limit";
import { sanitizeExternalText } from "@/lib/security/content";
import { audit } from "@/lib/audit";

const Body = z.object({ query: z.string().min(2).max(160), destination: z.string().max(120).nullable().optional(), force: z.boolean().optional() });
const REUSE_DAYS = 7;

/** Starts a durable contact-discovery job. Poll /api/contacts/searches/[id] for progress. */
export const POST = route("editor", async ({ user, req }) => {
  const b = await parseBody(req, Body);
  if (!searchConfigured()) throw new NotConfiguredError("search", "Contact search needs a search provider (TAVILY_API_KEY or BRAVE_SEARCH_API_KEY).");
  burstLimit(`contacts:${user.id}`, 4, 4);
  await checkDailyLimit(user.id, "contact_search");
  const query = sanitizeExternalText(b.query, 160);
  // Duplicate-request protection: reuse a recent completed search for the same query unless forced.
  if (!b.force) {
    const recent = await db().list("contact_searches", { orderBy: { column: "created_at" }, limit: 200 });
    const hit = recent.find((s) => s.query.toLowerCase() === query.toLowerCase() && s.status === "completed" && Date.now() - new Date(s.created_at).getTime() < REUSE_DAYS * 86400000);
    if (hit) return { search: hit, job: null, reused: true };
  }
  const search = await db().insert("contact_searches", {
    id: newId("cs_"),
    query,
    status: "running",
    contact_ids: [],
    organisation: null,
    notes: [],
    error: null,
    created_by: user.id,
    created_at: nowIso(),
  });
  const job = await createJob("contact_search", { query, search_id: search.id, destination: b.destination ?? null }, user.id);
  runInBackground(job.id);
  await audit(user.email, "contacts.search", query);
  return { search, job };
});
