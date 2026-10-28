import { test } from "node:test";
import assert from "node:assert/strict";
import { decideStatus, nameAppears, refSupports, titleAppears, verifiedEmail, verifiedPhone } from "../../src/lib/contacts/verify.ts";

const src = (url: string, text: string, published_at: string | null = new Date().toISOString()) => ({ url, title: "t", publisher: "p", text, published_at });
const text = "Asha Rao, Director India at Example Tourism Board, said the board would expand roadshows. Contact: india@exampletourism.org, +91 22 1234 5678.";

test("name and title must appear in the source", () => {
  assert.equal(nameAppears("Asha Rao", text), true);
  assert.equal(nameAppears("Asha Rao Kumar", text), false);
  assert.equal(titleAppears("Director India", text), true);
  assert.equal(titleAppears("Head of Partnerships", text), false);
  const ref = { source: src("https://www.exampletourism.org/team", text), quote: "Asha Rao, Director India at Example Tourism Board" };
  assert.equal(refSupports(ref, "Asha Rao", "Director India"), true);
  assert.equal(refSupports(ref, "Asha Rao", "Chief Executive"), false);
  assert.equal(refSupports({ ...ref, quote: "Asha Rao leads the global CEO office" }, "Asha Rao", "Director India"), false);
});

test("emails and phones are only kept when printed in a source", () => {
  assert.equal(verifiedEmail("india@exampletourism.org", [text]), "india@exampletourism.org");
  assert.equal(verifiedEmail("asha.rao@exampletourism.org", [text]), null);
  assert.equal(verifiedEmail("someone@gmail.com", ["someone@gmail.com"]), null);
  assert.equal(verifiedPhone("+91 22 1234 5678", [text]), "+91 22 1234 5678");
  assert.equal(verifiedPhone("+91 22 9999 0000", [text]), null);
});

test("status follows the evidence", () => {
  const off = { source: src("https://www.exampletourism.org/team", text), quote: "x" };
  const a = { source: src("https://news-a.com/1", text), quote: "x" };
  const b = { source: src("https://news-b.com/2", text), quote: "x" };
  assert.equal(decideStatus([off], ["exampletourism.org"]).status, "Officially Verified");
  assert.equal(decideStatus([a, b], []).status, "Cross-Verified");
  assert.equal(decideStatus([a], []).status, "Needs Verification");
  assert.equal(decideStatus([], []).status, "Not Found");
  const old = { source: src("https://news-c.com/3", text, "2020-01-01T00:00:00Z"), quote: "x" };
  const old2 = { source: src("https://news-d.com/4", text, "2020-02-01T00:00:00Z"), quote: "x" };
  assert.equal(decideStatus([old, old2], []).status, "Needs Verification");
});
