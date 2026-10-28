import "server-only";
import type { ZodType } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { env, NotConfiguredError } from "@/lib/env";
import { UNTRUSTED_GUARD } from "@/lib/security/content";
import { checkDailyLimit, recordUsage } from "@/lib/security/rate-limit";
import { getSettings } from "@/lib/settings";

export interface StructuredRequest<T> {
  /** Short task name, used for logging, usage tracking and demo fixtures. */
  task: string;
  schema: ZodType<T>;
  system: string;
  user: string;
  /** Use the creative model (campaign work) instead of the analytical model. */
  creative?: boolean;
  userId: string;
  /** Offline demo output, only used when PLOT_TWIST_DEMO_FIXTURES=true in development. */
  fixture?: () => T;
  maxTokens?: number;
}

const BASE_RULES = [
  "You work inside plot twist., an internal travel-intelligence and campaign tool for the marketing and tourism-partnerships team at Scapia, an Indian travel platform.",
  "Never invent facts, statistics, dates, names, quotes, URLs or contacts. If the evidence provided does not support something, leave it out or state the gap.",
  "Write in British English, crisply, without marketing clichés or em dashes.",
  UNTRUSTED_GUARD,
  "Respond with a single JSON object that matches the JSON schema provided. No prose outside JSON.",
].join("\n");

export class AiError extends Error {}

async function callOpenAI(model: string, messages: { role: string; content: string }[], maxTokens: number) {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.openaiKey}` },
        body: JSON.stringify({ model, messages, response_format: { type: "json_object" }, max_completion_tokens: maxTokens }),
        signal: AbortSignal.timeout(240_000),
      });
      if (res.status === 429 || res.status >= 500) {
        lastErr = new AiError(`OpenAI returned ${res.status}`);
        await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
        continue;
      }
      const body = await res.json();
      if (!res.ok) throw new AiError(body?.error?.message ?? `OpenAI returned ${res.status}`);
      const choice = body.choices?.[0];
      if (choice?.finish_reason === "length") throw new AiError("The AI response was cut off (output too long). Try quick depth or fewer items.");
      return { text: String(choice?.message?.content ?? ""), tokens: Number(body.usage?.total_tokens ?? 0) };
    } catch (e) {
      lastErr = e;
      if (e instanceof AiError && !String(e.message).startsWith("OpenAI returned 5") && !String(e.message).includes("429")) throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new AiError("AI request failed");
}

function extractJson(text: string): unknown {
  const t = text.trim();
  try {
    return JSON.parse(t);
  } catch {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1));
    throw new AiError("AI did not return JSON");
  }
}

/**
 * Structured generation: JSON output validated with Zod, with one automatic repair attempt.
 * Server-side only; the API key never reaches the browser.
 */
export async function generateStructured<T>(req: StructuredRequest<T>): Promise<T> {
  if (env.demoFixtures && req.fixture) {
    await recordUsage(req.userId, "ai", 1, { task: req.task, demo: true });
    return req.schema.parse(req.fixture());
  }
  if (!env.openaiKey) throw new NotConfiguredError("ai", "AI generation needs OPENAI_API_KEY. Add it in your environment, then reload.");
  await checkDailyLimit(req.userId, "ai");

  const settings = await getSettings();
  const model = req.creative ? env.openaiCreativeModel : settings.ai_model || env.openaiModel;
  const jsonSchema = JSON.stringify(zodToJsonSchema(req.schema, { $refStrategy: "none" }));
  const messages = [
    { role: "system", content: `${BASE_RULES}\n\n${req.system}\n\nJSON schema:\n${jsonSchema}` },
    { role: "user", content: req.user },
  ];

  const first = await callOpenAI(model, messages, req.maxTokens ?? 16000);
  await recordUsage(req.userId, "ai", 1, { task: req.task, model, tokens: first.tokens });
  let parsed = req.schema.safeParse(safeJson(first.text));
  if (parsed.success) return parsed.data;

  const issues = parsed.error.issues.slice(0, 12).map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
  const repair = await callOpenAI(
    model,
    [...messages, { role: "assistant", content: first.text }, { role: "user", content: `Your JSON did not match the schema:\n${issues}\nReturn the corrected full JSON object only.` }],
    req.maxTokens ?? 16000,
  );
  await recordUsage(req.userId, "ai", 1, { task: req.task + ":repair", model, tokens: repair.tokens });
  parsed = req.schema.safeParse(safeJson(repair.text));
  if (parsed.success) return parsed.data;
  throw new AiError(`The AI response for ${req.task} was not in the expected format. Please retry.`);
}

function safeJson(text: string): unknown {
  try {
    return extractJson(text);
  } catch {
    return null;
  }
}
