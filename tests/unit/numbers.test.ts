import { test } from "node:test";
import assert from "node:assert/strict";
import { textStatesNumber } from "../../src/lib/stats/numbers.ts";

test("matches common Indian and international formats", () => {
  assert.equal(textStatesNumber("India sent 2.1 million visitors to Thailand in 2024", 2100000), true);
  assert.equal(textStatesNumber("about 21 lakh Indian tourists", 2100000), true);
  assert.equal(textStatesNumber("Departures reached 3,28,30,000 in 2025", 32830000), true);
  assert.equal(textStatesNumber("a total of 501,427 visits", 501427), true);
  assert.equal(textStatesNumber("233,000 Indian tourists visited Japan", 233000), true);
});

test("does not match different or partial numbers", () => {
  assert.equal(textStatesNumber("12.1 million visitors", 2100000), false);
  assert.equal(textStatesNumber("a total of 5,014,270 visits", 501427), false);
  assert.equal(textStatesNumber("1.2 million", 2100000), false);
});
