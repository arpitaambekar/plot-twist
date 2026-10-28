import { z } from "zod";
import { route, parseBody } from "@/lib/api";
import { getSettings, updateSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";

const domain = z
  .string()
  .trim()
  .toLowerCase()
  .transform((d) => d.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, ""))
  .pipe(z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "must be a domain like example.com"));

const Patch = z
  .object({
    news_refresh_hours: z.number().int().min(1).max(168),
    news_lookback_days: z.number().int().min(1).max(365),
    default_research_depth: z.enum(["quick", "comprehensive"]),
    report_cache_days: z.number().int().min(0).max(365),
    daily_research_limit: z.number().int().min(0).max(10000),
    daily_ai_limit: z.number().int().min(0).max(100000),
    preferred_domains: z.array(domain).max(200),
    blocked_domains: z.array(domain).max(200),
    ai_model: z.string().trim().max(80).regex(/^[a-zA-Z0-9._:-]*$/, "invalid model id").nullable(),
    scoring_weights: z.record(z.string().max(40), z.number().min(0).max(10)),
  })
  .partial();

export const GET = route("admin", async () => ({ settings: await getSettings() }));

export const PATCH = route("admin", async ({ user, req }) => {
  const b = await parseBody(req, Patch);
  const before = await getSettings();
  const settings = await updateSettings({ ...b, ai_model: b.ai_model === "" ? null : b.ai_model === undefined ? before.ai_model : b.ai_model });
  const changed = Object.keys(b).filter((k) => JSON.stringify((before as unknown as Record<string, unknown>)[k]) !== JSON.stringify((settings as unknown as Record<string, unknown>)[k]));
  await audit(user.email, "admin.settings.update", "settings:global", { changed });
  return { settings };
});
