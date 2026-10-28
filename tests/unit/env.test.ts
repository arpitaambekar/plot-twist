import { test } from "node:test";
import assert from "node:assert/strict";
import { env } from "../../src/lib/env.ts";

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const saved = { ...process.env };
  for (const k of ["OPENAI_API_KEY", "OPENROUTER_API_KEY", "OPENAI_MODEL", "AI_BASE_URL"]) delete process.env[k];
  Object.assign(process.env, vars);
  try {
    fn();
  } finally {
    process.env = saved;
  }
}

test("OpenRouter key in OPENAI_API_KEY is detected", () =>
  withEnv({ OPENAI_API_KEY: "sk-or-v1-test" }, () => {
    assert.equal(env.aiProvider, "openrouter");
    assert.equal(env.aiBaseUrl, "https://openrouter.ai/api/v1");
    assert.equal(env.openaiModel, "openai/gpt-5-mini");
  }));

test("OPENROUTER_API_KEY takes precedence", () =>
  withEnv({ OPENROUTER_API_KEY: "sk-or-v1-x", OPENAI_API_KEY: "sk-abc" }, () => {
    assert.equal(env.aiProvider, "openrouter");
    assert.equal(env.openaiKey, "sk-or-v1-x");
  }));

test("plain OpenAI key uses OpenAI defaults", () =>
  withEnv({ OPENAI_API_KEY: "sk-abc" }, () => {
    assert.equal(env.aiProvider, "openai");
    assert.equal(env.aiBaseUrl, "https://api.openai.com/v1");
    assert.equal(env.openaiModel, "gpt-5-mini");
  }));
