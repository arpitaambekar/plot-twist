"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RotateCcw, Trash2, Pencil } from "lucide-react";
import type { IntegrationStatus } from "@/lib/env";
import type { AppSettings, AuditEntry, FeedConfig, Profile, ResearchJob, Role, UsageEvent } from "@/lib/types";
import { Badge, Card, EmptyState, Input, Label, Select, SectionTitle, Textarea } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client";
import { cn, fmtDateTime, timeAgo } from "@/lib/utils";
import { IntegrationPanel } from "./integration-panel";

export interface UsageSummary {
  kinds: UsageEvent["kind"][];
  byDay: { day: string; counts: Record<string, number> }[];
  users: { user: string; counts: Record<string, number> }[];
  totals: Record<string, number>;
  tokens: number;
  demoCalls: number;
}

const TABS = ["Integrations", "Sources & feeds", "Research & AI", "Users", "Usage & jobs", "Audit log"] as const;
type Tab = (typeof TABS)[number];

const KIND_LABEL: Record<string, string> = { research: "Research", ai: "AI calls", search: "Searches", contact_search: "Contact searches", news_refresh: "News refreshes", export: "Exports" };

export function AdminView(props: {
  currentUserId: string;
  integrations: IntegrationStatus;
  settings: AppSettings;
  feeds: FeedConfig[];
  profiles: Profile[];
  usage: UsageSummary;
  jobs: ResearchJob[];
  audit: AuditEntry[];
}) {
  const [tab, setTab] = useState<Tab>("Integrations");
  return (
    <div>
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-line" role="tablist" aria-label="Admin sections">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn("-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm transition-colors", tab === t ? "border-accent font-medium text-ink" : "border-transparent text-muted hover:text-ink")}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Integrations" && (
        <Card className="p-6">
          <SectionTitle title="Integration status" kicker="Secrets are never shown" />
          <IntegrationPanel status={props.integrations} showSetup />
          <p className="mt-4 text-[12px] text-muted">Environment variables are set in your hosting provider (or .env.local for development). See .env.example and the README. Restart or redeploy after changing them.</p>
        </Card>
      )}
      {tab === "Sources & feeds" && <SourcesTab settings={props.settings} feeds={props.feeds} />}
      {tab === "Research & AI" && <ResearchTab settings={props.settings} />}
      {tab === "Users" && <UsersTab profiles={props.profiles} currentUserId={props.currentUserId} />}
      {tab === "Usage & jobs" && <UsageTab usage={props.usage} jobs={props.jobs} settings={props.settings} />}
      {tab === "Audit log" && <AuditTab audit={props.audit} />}
    </div>
  );
}

function useMutate() {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast(ok);
      router.refresh();
      return true;
    } catch (e) {
      toast((e as Error).message, "error");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}

/* ---------------------------------------------------------------- sources & feeds */

const SOURCE_TYPES = ["trade", "news", "official", "government", "tourism_board", "airline", "research", "reference", "other"];
type FeedDraft = { name: string; url: string; publisher: string; source_type: string; enabled: boolean };

function SourcesTab({ settings, feeds }: { settings: AppSettings; feeds: FeedConfig[] }) {
  const { busy, run } = useMutate();
  const [preferred, setPreferred] = useState(settings.preferred_domains.join("\n"));
  const [blocked, setBlocked] = useState(settings.blocked_domains.join("\n"));
  const [editing, setEditing] = useState<FeedConfig | "new" | null>(null);
  const lines = (s: string) =>
    s
      .split(/[\n,]/)
      .map((x) => x.trim())
      .filter(Boolean);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <SectionTitle title="Source preferences" />
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="pref-dom" hint="one domain per line">
              Preferred domains
            </Label>
            <Textarea id="pref-dom" rows={6} value={preferred} onChange={(e) => setPreferred(e.target.value)} placeholder="tourism.gov.in" />
            <p className="mt-1 text-[12px] text-muted">Prioritised by research and news search when relevant.</p>
          </div>
          <div>
            <Label htmlFor="block-dom" hint="one domain per line">
              Blocked domains
            </Label>
            <Textarea id="block-dom" rows={6} value={blocked} onChange={(e) => setBlocked(e.target.value)} placeholder="content-farm.example" />
            <p className="mt-1 text-[12px] text-muted">Results from these domains are discarded everywhere.</p>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button loading={busy} onClick={() => run(() => api("/api/admin/settings", { method: "PATCH", json: { preferred_domains: lines(preferred), blocked_domains: lines(blocked) } }), "Source preferences saved.")}>
            Save preferences
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <SectionTitle
          title="News feeds"
          kicker="RSS / Atom"
          action={
            <Button variant="secondary" size="sm" onClick={() => setEditing("new")}>
              <Plus className="h-4 w-4" /> Add feed
            </Button>
          }
        />
        {feeds.length === 0 ? (
          <EmptyState title="No feeds configured." body="Add an official or trade RSS feed. Its status is recorded on the first ingestion run." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[12px] text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pr-3 font-medium">Feed</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Items</th>
                  <th className="py-2 pr-3 font-medium">Last checked</th>
                  <th className="py-2 pr-3 font-medium">Enabled</th>
                  <th className="py-2 font-medium sr-only">Actions</th>
                </tr>
              </thead>
              <tbody>
                {feeds.map((f) => (
                  <tr key={f.id} className="border-b border-line align-top last:border-0">
                    <td className="py-3 pr-3">
                      <p className="font-medium text-ink">{f.name}</p>
                      <a href={f.url} target="_blank" rel="noopener noreferrer" className="block max-w-[280px] truncate text-[12px] text-muted hover:text-accent">
                        {f.url}
                      </a>
                    </td>
                    <td className="py-3 pr-3 text-[13px] capitalize text-ink/80">{f.source_type.replace("_", " ")}</td>
                    <td className="py-3 pr-3">
                      <Badge tone={f.last_status === "ok" ? "mint" : f.last_status === "failed" ? "danger" : "neutral"}>{f.last_status === "never" ? "Never checked" : f.last_status === "ok" ? "Working" : "Failed"}</Badge>
                      {f.last_error && <p className="mt-1 max-w-[220px] text-[12px] text-danger">{f.last_error}</p>}
                    </td>
                    <td className="py-3 pr-3 tabular-nums">{f.item_count}</td>
                    <td className="py-3 pr-3 text-[13px] text-muted">{fmtDateTime(f.last_checked_at)}</td>
                    <td className="py-3 pr-3">
                      <input
                        type="checkbox"
                        checked={f.enabled}
                        aria-label={`${f.enabled ? "Disable" : "Enable"} ${f.name}`}
                        onChange={(e) => run(() => api(`/api/admin/feeds/${f.id}`, { method: "PATCH", json: { enabled: e.target.checked } }), e.target.checked ? "Feed enabled." : "Feed disabled.")}
                        className="h-4 w-4 accent-[#4169D7]"
                      />
                    </td>
                    <td className="py-3">
                      <div className="flex gap-1">
                        <button onClick={() => setEditing(f)} className="rounded-full p-1.5 text-muted hover:bg-ink/5 hover:text-ink" aria-label={`Edit ${f.name}`}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => confirm(`Delete the ${f.name} feed?`) && run(() => api(`/api/admin/feeds/${f.id}`, { method: "DELETE" }), "Feed deleted.")}
                          className="rounded-full p-1.5 text-muted hover:bg-soft-danger hover:text-danger"
                          aria-label={`Delete ${f.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[12px] text-muted">Only use feeds whose publishers permit it. Ingestion stores headline, summary and link, never full paywalled text.</p>
      </Card>

      {editing && (
        <FeedDialog
          feed={editing === "new" ? null : editing}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={async (d) => {
            const ok = await run(
              () => (editing === "new" ? api("/api/admin/feeds", { json: d }) : api(`/api/admin/feeds/${editing.id}`, { method: "PATCH", json: d })),
              editing === "new" ? "Feed added. It will be checked on the next refresh." : "Feed updated.",
            );
            if (ok) setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function FeedDialog({ feed, busy, onClose, onSave }: { feed: FeedConfig | null; busy: boolean; onClose: () => void; onSave: (d: FeedDraft) => void }) {
  const [d, setD] = useState<FeedDraft>({ name: feed?.name ?? "", url: feed?.url ?? "", publisher: feed?.publisher ?? "", source_type: feed?.source_type ?? "trade", enabled: feed?.enabled ?? true });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={feed ? `Edit ${feed.name}` : "Add a news feed"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(d);
        }}
        className="space-y-3"
      >
        <div>
          <Label htmlFor="fd-name">Name</Label>
          <Input id="fd-name" required value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="fd-url">Feed URL</Label>
          <Input id="fd-url" type="url" required value={d.url} onChange={(e) => setD({ ...d, url: e.target.value })} placeholder="https://…/feed" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="fd-pub">Publisher</Label>
            <Input id="fd-pub" required value={d.publisher} onChange={(e) => setD({ ...d, publisher: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="fd-type">Source type</Label>
            <Select id="fd-type" value={d.source_type} onChange={(e) => setD({ ...d, source_type: e.target.value })}>
              {SOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace("_", " ")}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={d.enabled} onChange={(e) => setD({ ...d, enabled: e.target.checked })} className="h-4 w-4 accent-[#4169D7]" /> Enabled
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            {feed ? "Save" : "Add feed"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- research & AI */

const WEIGHT_LABEL: Record<string, string> = {
  india_activity: "Evidence of India-market activity",
  timing: "Relevant timing",
  contact: "Verified contact available",
  research: "Research completeness",
  campaign: "Campaign development",
};

function ResearchTab({ settings }: { settings: AppSettings }) {
  const { busy, run } = useMutate();
  const [s, setS] = useState({
    news_refresh_hours: settings.news_refresh_hours,
    news_lookback_days: settings.news_lookback_days,
    default_research_depth: settings.default_research_depth,
    report_cache_days: settings.report_cache_days,
    daily_research_limit: settings.daily_research_limit,
    daily_ai_limit: settings.daily_ai_limit,
    ai_model: settings.ai_model ?? "",
    scoring_weights: { ...settings.scoring_weights },
  });
  const num = (k: keyof typeof s, label: string, hint: string, min: number, max: number) => (
    <div>
      <Label htmlFor={`rs-${k}`} hint={hint}>
        {label}
      </Label>
      <Input id={`rs-${k}`} type="number" min={min} max={max} value={s[k] as number} onChange={(e) => setS({ ...s, [k]: Number(e.target.value) })} />
    </div>
  );
  function save() {
    run(() => api("/api/admin/settings", { method: "PATCH", json: { ...s, ai_model: s.ai_model.trim() || null } }), "Settings saved.");
  }
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <SectionTitle title="Scheduled refresh" />
        <div className="grid gap-4 sm:grid-cols-2">
          {num("news_refresh_hours", "News refresh interval", "hours, 6–12 recommended", 1, 168)}
          {num("news_lookback_days", "News lookback window", "days", 1, 365)}
        </div>
        <p className="mt-2 text-[12px] text-muted">Last news refresh: {fmtDateTime(settings.last_news_refresh_at)}. Scheduled runs need CRON_SECRET.</p>
      </Card>
      <Card className="p-6">
        <SectionTitle title="Research" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="rs-depth">Default research depth</Label>
            <Select id="rs-depth" value={s.default_research_depth} onChange={(e) => setS({ ...s, default_research_depth: e.target.value as AppSettings["default_research_depth"] })}>
              <option value="comprehensive">Comprehensive research</option>
              <option value="quick">Quick overview</option>
            </Select>
          </div>
          {num("report_cache_days", "Reuse recent reports for", "days; 0 disables caching", 0, 365)}
        </div>
        <p className="mt-2 text-[12px] text-muted">When a matching report is newer than this, users get the cached report instead of a new costly research run, unless they choose Refresh.</p>
      </Card>
      <Card className="p-6">
        <SectionTitle title="Model and limits" />
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="rs-model" hint="optional">
              Analysis model override
            </Label>
            <Input id="rs-model" value={s.ai_model} onChange={(e) => setS({ ...s, ai_model: e.target.value })} placeholder="Uses OPENAI_MODEL" />
          </div>
          {num("daily_research_limit", "Daily research runs per user", "0 = unlimited", 0, 10000)}
          {num("daily_ai_limit", "Daily AI calls per user", "0 = unlimited", 0, 100000)}
        </div>
        <p className="mt-2 text-[12px] text-muted">Campaign generation uses OPENAI_CREATIVE_MODEL. Limits apply on a rolling 24 hours.</p>
      </Card>
      <Card className="p-6">
        <SectionTitle title="Opportunity scoring weights" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.keys({ ...WEIGHT_LABEL, ...s.scoring_weights }).map((k) => (
            <div key={k}>
              <Label htmlFor={`w-${k}`} hint="0–10">
                {WEIGHT_LABEL[k] ?? k}
              </Label>
              <Input
                id={`w-${k}`}
                type="number"
                min={0}
                max={10}
                step={0.5}
                value={s.scoring_weights[k] ?? 0}
                onChange={(e) => setS({ ...s, scoring_weights: { ...s.scoring_weights, [k]: Number(e.target.value) } })}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-muted">Weights only order opportunities for attention. Pitch readiness is always based on the actual checklist, never on these weights.</p>
      </Card>
      <div className="flex justify-end">
        <Button onClick={save} loading={busy}>
          Save settings
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- users */

function UsersTab({ profiles, currentUserId }: { profiles: Profile[]; currentUserId: string }) {
  const { run } = useMutate();
  const admins = profiles.filter((p) => p.role === "admin").length;
  return (
    <Card className="p-6">
      <SectionTitle title="People" kicker={`${profiles.length} user${profiles.length === 1 ? "" : "s"}`} />
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[12px] text-muted">
            <tr className="border-b border-line">
              <th className="py-2 pr-3 font-medium">Name</th>
              <th className="py-2 pr-3 font-medium">Email</th>
              <th className="py-2 pr-3 font-medium">Joined</th>
              <th className="py-2 font-medium">Role</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => {
              const lastAdmin = p.role === "admin" && admins <= 1;
              return (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="py-3 pr-3 font-medium text-ink">
                    {p.name} {p.id === currentUserId && <span className="text-[12px] font-normal text-muted">(you)</span>}
                  </td>
                  <td className="py-3 pr-3 text-ink/80">{p.email}</td>
                  <td className="py-3 pr-3 text-[13px] text-muted">{timeAgo(p.created_at)}</td>
                  <td className="py-3">
                    <Select
                      aria-label={`Role for ${p.name}`}
                      value={p.role}
                      className="h-9 w-36"
                      onChange={(e) => {
                        const role = e.target.value as Role;
                        if (p.id === currentUserId && role !== "admin" && !confirm("Remove your own admin access? You will lose access to this page.")) return;
                        run(() => api(`/api/admin/users/${encodeURIComponent(p.id)}`, { method: "PATCH", json: { role } }), `${p.name} is now ${role}.`);
                      }}
                    >
                      <option value="admin">Admin</option>
                      <option value="editor" disabled={lastAdmin}>
                        Editor
                      </option>
                      <option value="viewer" disabled={lastAdmin}>
                        Viewer
                      </option>
                    </Select>
                    {lastAdmin && <p className="mt-1 text-[11px] text-muted">Last admin</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] text-muted">New people get an account on first sign-in from an allowed domain (ALLOWED_EMAIL_DOMAINS). Emails in ADMIN_EMAILS start as admins; everyone else starts as editor.</p>
    </Card>
  );
}

/* ---------------------------------------------------------------- usage & jobs */

function UsageTab({ usage, jobs, settings }: { usage: UsageSummary; jobs: ResearchJob[]; settings: AppSettings }) {
  const { busy, run } = useMutate();
  const visibleKinds = usage.kinds.filter((k) => usage.totals[k] > 0 || ["research", "ai", "search"].includes(k));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Research runs", usage.totals.research ?? 0],
          ["AI calls", usage.totals.ai ?? 0],
          ["Searches", usage.totals.search ?? 0],
          ["AI tokens", usage.tokens.toLocaleString("en-IN")],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-[12px] text-muted">{label} · 14 days</p>
            <p className="mt-1 text-[24px] font-semibold tabular-nums tracking-[-0.02em] text-ink">{value}</p>
          </Card>
        ))}
      </div>
      {usage.demoCalls > 0 && <p className="text-[12px] text-muted">{usage.demoCalls} of these AI calls used offline demo fixtures (no cost).</p>}

      <Card className="p-6">
        <SectionTitle title="Daily usage" kicker={`Limits: ${settings.daily_research_limit || "∞"} research, ${settings.daily_ai_limit || "∞"} AI calls per user per day`} />
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm tabular-nums">
            <thead className="text-[12px] text-muted">
              <tr className="border-b border-line">
                <th className="py-2 pr-3 text-left font-medium">Day</th>
                {visibleKinds.map((k) => (
                  <th key={k} className="py-2 pl-3 font-medium">
                    {KIND_LABEL[k]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...usage.byDay].reverse().map((d) => (
                <tr key={d.day} className="border-b border-line last:border-0">
                  <td className="py-2 pr-3 text-left text-ink/80">{new Date(d.day).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</td>
                  {visibleKinds.map((k) => (
                    <td key={k} className={cn("py-2 pl-3", d.counts[k] ? "text-ink" : "text-muted/50")}>
                      {d.counts[k] || "·"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-6">
        <SectionTitle title="By person" kicker="Last 14 days" />
        {usage.users.length === 0 ? (
          <p className="text-sm text-muted">No usage recorded in the last 14 days.</p>
        ) : (
          <table className="w-full text-right text-sm tabular-nums">
            <thead className="text-[12px] text-muted">
              <tr className="border-b border-line">
                <th className="py-2 pr-3 text-left font-medium">Person</th>
                {visibleKinds.map((k) => (
                  <th key={k} className="py-2 pl-3 font-medium">
                    {KIND_LABEL[k]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usage.users.map((u) => (
                <tr key={u.user} className="border-b border-line last:border-0">
                  <td className="py-2 pr-3 text-left text-ink">{u.user}</td>
                  {visibleKinds.map((k) => (
                    <td key={k} className="py-2 pl-3">
                      {u.counts[k] || 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="p-6">
        <SectionTitle title="Recent jobs" kicker="Research, contacts, news, campaigns" />
        {jobs.length === 0 ? (
          <p className="text-sm text-muted">No background jobs yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {jobs.map((j) => (
              <li key={j.id} className="flex flex-wrap items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">
                    {j.kind.replace(/_/g, " ")}
                    {typeof j.input.destination === "string" && <span className="font-normal text-muted"> · {j.input.destination}</span>}
                    {typeof j.input.query === "string" && <span className="font-normal text-muted"> · {j.input.query}</span>}
                  </p>
                  <p className="text-[12px] text-muted">
                    Created {timeAgo(j.created_at)} · updated {timeAgo(j.updated_at)} · attempt {j.attempts}
                  </p>
                  {j.error && <p className="mt-1 text-[12px] text-danger">{j.error}</p>}
                </div>
                <Badge tone={j.status === "completed" ? "mint" : j.status === "failed" ? "danger" : "blue"}>{j.status.replace(/_/g, " ")}</Badge>
                {j.status === "failed" && (
                  <Button size="sm" variant="secondary" loading={busy} onClick={() => run(() => api(`/api/admin/jobs/${j.id}/retry`, { method: "POST" }), "Job re-queued.")}>
                    <RotateCcw className="h-3.5 w-3.5" /> Retry
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- audit */

function AuditTab({ audit }: { audit: AuditEntry[] }) {
  const [q, setQ] = useState("");
  const shown = audit.filter((a) => !q || `${a.actor} ${a.action} ${a.target}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Card className="p-6">
      <SectionTitle title="Audit log" kicker={`Latest ${audit.length} entries`} action={<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="h-9 w-48" aria-label="Filter audit log" />} />
      {shown.length === 0 ? (
        <p className="text-sm text-muted">No entries.</p>
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((a) => (
            <li key={a.id} className="grid gap-1 py-2.5 text-sm sm:grid-cols-[170px_1fr_auto] sm:items-baseline sm:gap-4">
              <span className="text-[12px] tabular-nums text-muted">{fmtDateTime(a.created_at)}</span>
              <span className="min-w-0">
                <span className="font-medium text-ink">{a.action}</span> <span className="text-muted">on</span> <span className="break-all text-ink/80">{a.target}</span>
              </span>
              <span className="truncate text-[12px] text-muted">{a.actor}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
