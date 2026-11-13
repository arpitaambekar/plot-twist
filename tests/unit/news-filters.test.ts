import { test } from "node:test";
import assert from "node:assert/strict";
import { applyFilters, DEFAULT_FILTERS } from "../../src/components/home/shared.ts";

const story = (id: string, india_relevance: "High" | "Medium" | "Low") =>
  ({ id, india_relevance, title: id, summary: "", category: "Industry", destinations: [], continent: null, tourism_board: null, source_type: "trade", published_at: new Date().toISOString(), retrieved_at: new Date().toISOString() }) as never;

test("Home hides Low India-relevance stories by default and shows them on request", () => {
  const news = [story("a", "High"), story("b", "Medium"), story("c", "Low")];
  assert.deepEqual(applyFilters(news, DEFAULT_FILTERS, new Set()).map((n: { id: string }) => n.id), ["a", "b"]);
  assert.equal(applyFilters(news, { ...DEFAULT_FILTERS, relevance: "" }, new Set()).length, 3);
  assert.deepEqual(applyFilters(news, { ...DEFAULT_FILTERS, relevance: "Low" }, new Set()).map((n: { id: string }) => n.id), ["c"]);
});
