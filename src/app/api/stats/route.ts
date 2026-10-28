import { z } from "zod";
import { route, parseBody, HttpError } from "@/lib/api";
import { db, newId, nowIso } from "@/lib/db";
import { safeUrl } from "@/lib/security/content";
import { audit } from "@/lib/audit";
import type { OutboundStat } from "@/lib/types";

export const GET = route("viewer", async () => {
  const items = await db().list("outbound_stats", { orderBy: { column: "created_at" } });
  return { items };
});

const Body = z.object({
  metric: z.string().min(3).max(120),
  destination: z.string().min(2).max(120),
  value: z.number().finite(),
  unit: z.string().min(1).max(40),
  reporting_period: z.string().min(2).max(80),
  definition: z.string().min(10).max(500),
  geography: z.string().min(3).max(200),
  yoy_change_pct: z.number().finite().nullable().optional(),
  comparison_value: z.number().finite().nullable().optional(),
  comparison_period: z.string().max(80).nullable().optional(),
  publisher: z.string().min(2).max(160),
  source_title: z.string().min(2).max(300),
  source_url: z.string().url(),
  source_type: z.enum(["official", "government", "tourism_board", "trade", "news", "research", "other"]),
  published_date: z.string().max(20).nullable().optional(),
  notes: z.string().max(800).default(""),
  /** The editor confirms they opened the source and saw the figure. */
  confirmed_in_source: z.literal(true),
});

/** Editors add statistics by hand; every field the spec requires is mandatory. */
export const POST = route("editor", async ({ user, req }) => {
  const b = await parseBody(req, Body);
  const url = safeUrl(b.source_url);
  if (!url) throw new HttpError(400, "The source link must be a public http(s) URL.");
  const primary = ["official", "government", "tourism_board"].includes(b.source_type);
  const stat: OutboundStat = {
    id: newId("stat_"),
    metric: b.metric,
    destination: b.destination,
    value: b.value,
    unit: b.unit,
    reporting_period: b.reporting_period,
    definition: b.definition,
    geography: b.geography,
    yoy_change_pct: b.yoy_change_pct ?? null,
    comparison_value: b.comparison_value ?? null,
    comparison_period: b.comparison_period ?? null,
    publisher: b.publisher,
    source_title: b.source_title,
    source_url: url,
    source_type: b.source_type,
    published_date: b.published_date ?? null,
    verified_at: nowIso(),
    notes: b.notes,
    // A human-checked primary source counts as Verified; anything else still needs corroboration.
    status: primary ? "Verified" : "Needs Verification",
    created_by: user.name,
    created_at: nowIso(),
  };
  await db().insert("outbound_stats", stat);
  await audit(user.email, "stat.create", stat.id, { metric: stat.metric, destination: stat.destination });
  return { stat };
});
