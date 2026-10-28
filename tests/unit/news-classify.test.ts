import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalUrl, classifyArticle, titleKey } from "../../src/lib/news/classify.ts";

const dir = [{ id: "japan", name: "Japan", slug: "japan", kind: "country", country: "Japan", continent: "Asia", tourism_board: "Japan National Tourism Organization (JNTO)", board_website: "https://www.japan.travel/", india_page: null, photo_query: "", photo_file: null, tagline: null, board_verified: true, created_at: "" }] as never;

test("classifies a visa story for Indian passport holders as high India relevance", () => {
  const c = classifyArticle("Japan eases e-visa rules for Indian passport holders", "The change applies from next month.", dir);
  assert.equal(c.category, "Visa & entry");
  assert.deepEqual(c.destinations, ["Japan"]);
  assert.equal(c.continent, "Asia");
  assert.equal(c.india_relevance, "High");
});

test("detects destinations through city aliases and route stories", () => {
  const c = classifyArticle("Airline launches non-stop Delhi to Osaka flights", "", dir);
  assert.equal(c.category, "Connectivity");
  assert.ok(c.destinations.includes("Japan"));
});

test("does not match 'us' as the United States", () => {
  const c = classifyArticle("Tell us about your favourite festival", "", dir);
  assert.ok(!c.destinations.includes("United States"));
});

test("syndicated copies share a dedupe key; tracking params are stripped", () => {
  assert.equal(titleKey("Japan eases e-visa rules for Indian travellers"), titleKey("[DEMO] Japan eases E-Visa rules for Indian travellers!"));
  assert.equal(canonicalUrl("https://www.example.com/a/?utm_source=x&id=2#top"), "https://example.com/a?id=2");
});
