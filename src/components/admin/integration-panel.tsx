import { CheckCircle2, CircleDashed, AlertTriangle } from "lucide-react";
import type { IntegrationStatus } from "@/lib/env";
import { cn } from "@/lib/utils";

interface Row {
  name: string;
  state: "ok" | "partial" | "missing";
  detail: string;
  setup?: string;
}

/** Read-only integration status. Shows only booleans and provider names, never secrets. */
export function integrationRows(s: IntegrationStatus): Row[] {
  return [
    {
      name: "Database",
      state: s.database === "supabase" ? "ok" : "partial",
      detail: s.database === "supabase" ? "Supabase PostgreSQL" : "Local file store (.data/). Development only, not shared between servers.",
      setup: "Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY, then run supabase/migrations/0001_init.sql.",
    },
    {
      name: "Authentication",
      state: s.auth === "supabase-google" ? "ok" : "partial",
      detail: s.auth === "supabase-google" ? "Supabase Auth with Google Workspace" : "Local signed-cookie sign-in (development).",
      setup: "Configure Supabase (above), enable the Google provider in Supabase Auth, and set ALLOWED_EMAIL_DOMAINS and ADMIN_EMAILS. Set SESSION_SECRET for local sign-in.",
    },
    {
      name: "AI (OpenAI)",
      state: s.ai && !s.demoFixtures ? "ok" : "missing",
      detail: s.ai && !s.demoFixtures ? "Configured on the server" : s.demoFixtures ? "Demo fixtures only, no real AI" : "Not configured. Research, campaigns and outreach drafts are disabled.",
      setup: "Set OPENAI_API_KEY. Optional: OPENAI_MODEL (analysis) and OPENAI_CREATIVE_MODEL (campaigns).",
    },
    {
      name: "Web search",
      state: s.search && !s.demoFixtures ? "ok" : "missing",
      detail: s.search && !s.demoFixtures ? `Provider: ${s.search === "tavily" ? "Tavily" : "Brave Search"}` : s.demoFixtures ? "Demo fixtures only, no live search" : "Not configured. Live research, news search and contact discovery are disabled.",
      setup: "Set TAVILY_API_KEY (recommended) or BRAVE_SEARCH_API_KEY.",
    },
    {
      name: "Images",
      state: "ok",
      detail: s.images.join(", "),
      setup: "Wikimedia Commons needs no key. Optional: UNSPLASH_ACCESS_KEY or PEXELS_API_KEY.",
    },
    {
      name: "Scheduled jobs",
      state: s.cron ? "ok" : "missing",
      detail: s.cron ? "CRON_SECRET set; scheduled news refresh and job recovery can run" : "CRON_SECRET not set; scheduled refresh and stalled-job recovery will not run",
      setup: "Set CRON_SECRET and keep the cron entries in vercel.json (Vercel sends it as a Bearer token).",
    },
    {
      name: "Demo fixtures",
      state: s.demoFixtures ? "partial" : "ok",
      detail: s.demoFixtures ? "ON: results are offline placeholders, not real research" : "Off",
      setup: "Set PLOT_TWIST_DEMO_FIXTURES=false (or remove it). Fixtures never run in production.",
    },
  ];
}

export function IntegrationPanel({ status, showSetup }: { status: IntegrationStatus; showSetup?: boolean }) {
  return (
    <ul className="divide-y divide-line">
      {integrationRows(status).map((r) => (
        <li key={r.name} className="flex items-start gap-3 py-3">
          {r.state === "ok" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-mint-ink" aria-label="Configured" />
          ) : r.state === "partial" ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-peach-ink" aria-label="Partly configured" />
          ) : (
            <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-label="Not configured" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">{r.name}</p>
            <p className={cn("text-[13px]", r.state === "missing" ? "text-danger" : "text-muted")}>{r.detail}</p>
            {showSetup && r.state !== "ok" && r.setup && <p className="mt-1 rounded-lg bg-ivory px-2.5 py-1.5 font-mono text-[12px] text-ink/80">{r.setup}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}
