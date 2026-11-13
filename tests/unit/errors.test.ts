import { test } from "node:test";
import assert from "node:assert/strict";
import { describeError } from "../../src/lib/errors.ts";

test("explains corporate proxy certificate failures", () => {
  const e = new TypeError("fetch failed", { cause: { code: "UNABLE_TO_GET_ISSUER_CERT_LOCALLY" } });
  assert.match(describeError(e), /use-system-ca/);
});

test("explains DNS failures and leaves other errors alone", () => {
  assert.match(describeError(new TypeError("fetch failed", { cause: { code: "ENOTFOUND" } })), /DNS/);
  assert.equal(describeError(new Error("Search provider (Tavily) returned 401")), "Search provider (Tavily) returned 401");
});
