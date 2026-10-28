import { ShieldAlert } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { integrationStatus } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import type { UsageEvent } from "@/lib/types";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { AdminView, type UsageSummary } from "@/components/admin/admin-view";

export const metadata = { title: "Admin" };

const KINDS: UsageEvent["kind"][] = ["research", "ai", "search", "contact_search", "news_refresh", "export"];

export default async function AdminPage() {
  const user = (await getCurrentUser())!;
  if (user.role !== "admin") {
    return (
      <div>
        <PageHeader eyebrow="Integrations and administration" title="Admin" />
        <EmptyState icon={<ShieldAlert className="h-8 w-8" />} title="Permission denied." body={`Admin is limited to admins. Your role is ${user.role}. Ask an admin if you need access.`} />
      </div>
    );
  }

  const s = db();
  const [settings, feeds, profiles, usage, jobs, auditLog] = await Promise.all([
    getSettings(),
    s.list("feeds"),
    s.list("profiles", { orderBy: { column: "created_at", ascending: true } }),
    s.list("usage_events", { orderBy: { column: "created_at" }, limit: 5000 }),
    s.list("research_jobs", { orderBy: { column: "created_at" }, limit: 40 }),
    s.list("audit_log", { orderBy: { column: "created_at" }, limit: 80 }),
  ]);

  // Usage over the last 14 days, aggregated from stored usage events.
  const since = Date.now() - 14 * 86400000;
  const recent = usage.filter((u) => new Date(u.created_at).getTime() >= since);
  const days = Array.from({ length: 14 }, (_, i) => new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10));
  const byDay = days.map((day) => ({ day, counts: Object.fromEntries(KINDS.map((k) => [k, recent.filter((u) => u.kind === k && u.created_at.slice(0, 10) === day).reduce((n, u) => n + u.units, 0)])) }));
  const names = new Map(profiles.map((p) => [p.id, p.name]));
  const users = [...new Set(recent.map((u) => u.user_id))].map((id) => ({
    user: names.get(id) ?? id,
    counts: Object.fromEntries(KINDS.map((k) => [k, recent.filter((u) => u.user_id === id && u.kind === k).reduce((n, u) => n + u.units, 0)])),
  }));
  const tokens = recent.reduce((n, u) => n + (typeof u.meta.tokens === "number" ? u.meta.tokens : 0), 0);
  const totals = Object.fromEntries(KINDS.map((k) => [k, recent.filter((u) => u.kind === k).reduce((n, u) => n + u.units, 0)]));
  const summary: UsageSummary = { kinds: KINDS, byDay, users, totals, tokens, demoCalls: recent.filter((u) => u.meta.demo === true).length };

  return (
    <div>
      <PageHeader eyebrow="Integrations and administration" title="Admin" subtitle="Connections, sources, limits, people and what the platform has been doing." />
      <AdminView currentUserId={user.id} integrations={integrationStatus()} settings={settings} feeds={feeds} profiles={profiles} usage={summary} jobs={jobs} audit={auditLog} />
    </div>
  );
}
