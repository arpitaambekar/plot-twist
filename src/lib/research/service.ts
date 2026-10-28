import "server-only";
import { z } from "zod";
import { db, newId, nowIso } from "@/lib/db";
import { integrationStatus, NotConfiguredError } from "@/lib/env";
import { checkDailyLimit, recordUsage, burstLimit } from "@/lib/security/rate-limit";
import { createJob, runInBackground } from "@/lib/jobs";
import { getSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { HttpError } from "@/lib/api";
import { sanitizeExternalText } from "@/lib/security/content";
import { slugify } from "@/lib/seed";
import type { SessionUser } from "@/lib/auth/session";
import type { Claim, Destination, Report, ReportOptions, ReportVersion, SourceRecord } from "@/lib/types";
import type { ResearchJobInput } from "./pipeline";

export const TRAVELLER_TYPES = ["All", "Couples", "Families", "Solo travellers", "Friends", "Adventure travellers", "Luxury travellers"] as const;

export const StartSchema = z.object({
  destination: z.string().trim().min(2).max(120),
  kind: z.enum(["country", "city", "region", "island", "province", "area"]).optional(),
  country: z.string().trim().max(120).optional(),
  options: z.object({
    traveller_type: z.enum(TRAVELLER_TYPES).default("All"),
    travel_period: z.string().trim().max(60).default("Any season"),
    depth: z.enum(["quick", "comprehensive"]).default("comprehensive"),
  }),
  force: z.boolean().default(false),
});

const sameOptions = (a: ReportOptions, b: ReportOptions) => a.traveller_type === b.traveller_type && (a.travel_period || "Any season") === (b.travel_period || "Any season") && a.depth === b.depth;

function ensureConfigured() {
  const s = integrationStatus();
  if (!s.search) throw new NotConfiguredError("search", "Destination research needs a search provider. Add TAVILY_API_KEY (recommended) or BRAVE_SEARCH_API_KEY.");
  if (!s.ai) throw new NotConfiguredError("ai", "Destination research needs OPENAI_API_KEY to extract and organise sourced facts.");
}

async function findDestination(name: string): Promise<Destination | null> {
  const all = await db().list("destinations");
  const n = name.trim().toLowerCase();
  return all.find((d) => d.name.toLowerCase() === n || d.slug === slugify(name)) ?? null;
}

export interface StartResult {
  report_id: string;
  job_id: string | null;
  status: "started" | "cached" | "in_progress";
  cached_at?: string;
}

export async function startResearch(user: SessionUser, body: z.infer<typeof StartSchema>): Promise<StartResult> {
  const destName = sanitizeExternalText(body.destination, 120);
  const options: ReportOptions = { ...body.options, travel_period: body.options.travel_period || "Any season" };
  const store = db();
  const existing = (await store.list("reports", { orderBy: { column: "updated_at" }, limit: 500 })).filter(
    (r) => r.destination_name.toLowerCase() === destName.toLowerCase() && sameOptions(r.options, options),
  );

  // Duplicate request detection: a run for the same destination and options is already going.
  const running = existing.find((r) => r.status === "generating");
  if (running) return { report_id: running.id, job_id: running.job_id, status: "in_progress" };

  // Research caching: reuse a recent report unless the user explicitly asks for a fresh run.
  const settings = await getSettings();
  const fresh = existing.find((r) => (r.status === "completed" || r.status === "partial") && Date.now() - new Date(r.updated_at).getTime() < settings.report_cache_days * 86400000);
  if (fresh && !body.force) return { report_id: fresh.id, job_id: null, status: "cached", cached_at: fresh.updated_at };

  ensureConfigured();
  burstLimit(`research:${user.id}`, 4, 4);
  await checkDailyLimit(user.id, "research");

  // A forced run for an existing report creates a new version of it.
  if (fresh && body.force) return refreshReport(user, fresh.id);

  const dest = await findDestination(destName);
  // Sub-national places (city, island, region) keep their own name; the confirmed country is research context.
  const subNational = !dest && body.kind && body.kind !== "country" && body.country;
  const report: Report = {
    id: newId("rep_"),
    destination_id: dest?.id ?? null,
    destination_name: dest?.name ?? destName,
    query: subNational ? `${destName}, ${body.country}` : (dest?.name ?? destName),
    options,
    version: 0,
    status: "generating",
    content: null,
    source_ids: [],
    health: null,
    job_id: null,
    partial_notes: [],
    created_by: user.id,
    created_at: nowIso(),
    updated_at: nowIso(),
    is_demo: false,
  };
  await store.insert("reports", report);
  const input: ResearchJobInput = { report_id: report.id, version: 1, destination: report.query, destination_id: report.destination_id, options };
  const job = await createJob("destination_report", input as unknown as Record<string, unknown>, user.id);
  await store.update("reports", report.id, { job_id: job.id });
  await recordUsage(user.id, "research", 1, { destination: report.query, depth: options.depth });
  await audit(user.email, "research.start", report.id, { destination: report.query });
  runInBackground(job.id);
  return { report_id: report.id, job_id: job.id, status: "started" };
}

export async function refreshReport(user: SessionUser, reportId: string): Promise<StartResult> {
  const store = db();
  const report = await store.get("reports", reportId);
  if (!report) throw new HttpError(404, "Report not found.");
  if (report.status === "generating") return { report_id: report.id, job_id: report.job_id, status: "in_progress" };
  ensureConfigured();
  burstLimit(`research:${user.id}`, 4, 4);
  await checkDailyLimit(user.id, "research");
  const versions = await store.list("report_versions", { where: { report_id: reportId } as never });
  const nextVersion = Math.max(report.version, ...versions.map((v) => v.version), 0) + 1;
  const input: ResearchJobInput = { report_id: report.id, version: nextVersion, destination: report.query, destination_id: report.destination_id, options: report.options };
  const job = await createJob("destination_report", input as unknown as Record<string, unknown>, user.id);
  await store.update("reports", report.id, { status: "generating", job_id: job.id, updated_at: nowIso() });
  await recordUsage(user.id, "research", 1, { destination: report.query, refresh: true });
  await audit(user.email, "research.refresh", report.id, { version: nextVersion });
  runInBackground(job.id);
  return { report_id: report.id, job_id: job.id, status: "started" };
}

export interface ReportBundle {
  report: Report;
  version: number;
  content: Report["content"];
  health: Report["health"];
  source_ids: string[];
  claims: Claim[];
  sources: SourceRecord[];
  versions: Pick<ReportVersion, "version" | "created_at" | "change_summary" | "health">[];
  is_latest: boolean;
}

/** Load a report at an exact version (current if omitted) with its claims and sources. */
export async function loadReportVersion(id: string, version?: number | null): Promise<ReportBundle | null> {
  const store = db();
  const report = await store.get("reports", id);
  if (!report) return null;
  const versionRows = await store.list("report_versions", { where: { report_id: id } as never, orderBy: { column: "version" } });
  const v = version && version > 0 ? version : report.version;
  const row = versionRows.find((r) => r.version === v) ?? null;
  const content = row ? row.content : v === report.version ? report.content : null;
  const sourceIds = row ? row.source_ids : report.source_ids;
  const claims = v > 0 ? await store.list("claims", { where: { subject_type: "report", subject_id: `${id}:v${v}` } as never }) : [];
  const sources = sourceIds.length ? await store.list("sources", { in: { column: "id", values: sourceIds } }) : [];
  const order = new Map(sourceIds.map((sid, i) => [sid, i]));
  sources.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return {
    report,
    version: v,
    content,
    health: row?.health ?? report.health,
    source_ids: sourceIds,
    claims,
    sources,
    versions: versionRows.map((r) => ({ version: r.version, created_at: r.created_at, change_summary: r.change_summary, health: r.health })),
    is_latest: v === report.version,
  };
}
