import { test } from "node:test";
import assert from "node:assert/strict";
import { computeReadiness } from "../../src/lib/opportunities/readiness.ts";
import type { Opportunity, Contact } from "../../src/lib/types.ts";

const base: Opportunity = {
  id: "opp_1", name: "Test", destination: "Philippines", tourism_board: null, summary: "", stage: "Identified", priority: "Medium",
  owner: null, next_action: null, next_action_date: null, last_interaction: null, campaign_window: null, commercial_notes: null, notes: "",
  news_ids: [], report_id: null, idea_ids: [], shortlisted_idea_id: null, pitch_id: null, contact_ids: [], source_links: [], manual_checks: {},
  created_by: "u", created_at: "", updated_at: "",
};
const empty = { report: null, reportClaims: null, ideas: [], sets: [], pitch: null, contacts: [] as Contact[], news: [] };

test("an empty opportunity has nothing marked complete", () => {
  const r = computeReadiness(base, empty);
  assert.equal(r.completed, 0);
  assert.equal(r.pct, 0);
  assert.equal(r.status, "Research Needed");
  const manual = r.groups.flatMap((g) => g.items).filter((i) => i.kind === "manual");
  assert.ok(manual.length >= 7);
  assert.ok(manual.every((i) => i.state === "not_assessed"));
  assert.equal(r.next?.key, "research_exists");
});

test("manual answers are respected and percentages come from the checklist", () => {
  const r = computeReadiness({ ...base, tourism_board: "Department of Tourism", manual_checks: { inventory_checked: true, channels_assessed: false } }, empty);
  const items = Object.fromEntries(r.groups.flatMap((g) => g.items).map((i) => [i.key, i.state]));
  assert.equal(items.inventory_checked, "done");
  assert.equal(items.channels_assessed, "missing");
  assert.equal(items.measurement_defined, "not_assessed");
  assert.equal(items.board_identified, "done");
  assert.equal(r.completed, 2);
  assert.equal(r.pct, Math.round((2 / r.total) * 100));
});

test("a verified contact with a route completes contact availability", () => {
  const c = { id: "c", status: "Officially Verified", last_verified_at: new Date().toISOString(), email: "x@board.org" } as unknown as Contact;
  const r = computeReadiness({ ...base, contact_ids: ["c"] }, { ...empty, contacts: [c] });
  const C = r.groups.find((g) => g.key === "C")!;
  assert.ok(C.items.every((i) => i.state === "done"));
  const stale = { ...c, last_verified_at: "2020-01-01T00:00:00Z" } as Contact;
  const r2 = computeReadiness({ ...base, contact_ids: ["c"] }, { ...empty, contacts: [stale] });
  assert.equal(r2.groups.find((g) => g.key === "C")!.items.find((i) => i.key === "role_verified")!.state, "missing");
});
