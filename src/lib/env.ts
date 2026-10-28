/**
 * Central, server-side view of configuration. Secrets never leave the server:
 * only booleans from `integrationStatus()` are sent to the browser.
 */

function v(name: string): string | undefined {
  const val = process.env[name];
  return val && val.trim() !== "" ? val.trim() : undefined;
}

export const env = {
  get appUrl() {
    return v("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000";
  },
  get supabaseUrl() {
    return v("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return v("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get supabaseServiceKey() {
    return v("SUPABASE_SERVICE_ROLE_KEY");
  },
  get supabaseConfigured() {
    return Boolean(this.supabaseUrl && this.supabaseAnonKey && this.supabaseServiceKey);
  },
  get openaiKey() {
    return v("OPENAI_API_KEY");
  },
  get openaiModel() {
    return v("OPENAI_MODEL") ?? "gpt-5-mini";
  },
  get openaiCreativeModel() {
    return v("OPENAI_CREATIVE_MODEL") ?? v("OPENAI_MODEL") ?? "gpt-5";
  },
  get tavilyKey() {
    return v("TAVILY_API_KEY");
  },
  get braveKey() {
    return v("BRAVE_SEARCH_API_KEY");
  },
  get unsplashKey() {
    return v("UNSPLASH_ACCESS_KEY");
  },
  get pexelsKey() {
    return v("PEXELS_API_KEY");
  },
  get cronSecret() {
    return v("CRON_SECRET");
  },
  get sessionSecret() {
    return v("SESSION_SECRET") ?? "dev-only-insecure-secret-change-me";
  },
  get allowedDomains(): string[] {
    return (v("ALLOWED_EMAIL_DOMAINS") ?? "")
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
  },
  get adminEmails(): string[] {
    return (v("ADMIN_EMAILS") ?? "")
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
  },
  /** Local development only: clearly-labelled fixture providers for offline testing. */
  get demoFixtures() {
    return v("PLOT_TWIST_DEMO_FIXTURES") === "true" && process.env.NODE_ENV !== "production";
  },
  get dataDir() {
    return v("PLOT_TWIST_DATA_DIR") ?? ".data";
  },
};

export interface IntegrationStatus {
  database: "supabase" | "local";
  auth: "supabase-google" | "local";
  ai: boolean;
  search: "tavily" | "brave" | null;
  images: string[];
  demoFixtures: boolean;
  cron: boolean;
}

export function integrationStatus(): IntegrationStatus {
  const images = ["Wikimedia Commons"];
  if (env.unsplashKey) images.push("Unsplash");
  if (env.pexelsKey) images.push("Pexels");
  return {
    database: env.supabaseConfigured ? "supabase" : "local",
    auth: env.supabaseConfigured ? "supabase-google" : "local",
    ai: Boolean(env.openaiKey) || env.demoFixtures,
    search: env.tavilyKey ? "tavily" : env.braveKey ? "brave" : env.demoFixtures ? "tavily" : null,
    images,
    demoFixtures: env.demoFixtures,
    cron: Boolean(env.cronSecret),
  };
}

export class NotConfiguredError extends Error {
  constructor(public integration: "ai" | "search" | "database", message?: string) {
    super(message ?? `${integration} integration is not configured`);
    this.name = "NotConfiguredError";
  }
}
