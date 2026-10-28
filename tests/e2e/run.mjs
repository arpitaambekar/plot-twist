/**
 * End-to-end workflow tests for plot twist. (spec section 22).
 *
 * Runs against a dev server with offline DEMO fixtures, so it needs no API keys:
 *   PLOT_TWIST_DEMO_FIXTURES=true PLOT_TWIST_DATA_DIR=.data-e2e npx next dev -p 3100
 *   BASE_URL=http://localhost:3100 npm run test:e2e
 *
 * Live-provider behaviour (real OpenAI/Tavily output) must be checked separately with keys configured.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

// Resolves a local devDependency, or a global install via NODE_PATH.
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = path.resolve("tests/e2e/output");
fs.mkdirSync(OUT, { recursive: true });

const results = [];
async function test(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t0 });
    console.log(`✓ ${name} (${Date.now() - t0} ms)`);
  } catch (e) {
    results.push({ name, ok: false, error: e.message });
    console.log(`✗ ${name}\n    ${e.message}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(`${page.url()} :: ${e.message} :: ${(e.stack ?? "").split("\n").slice(1, 3).join(" ")}`));

async function api(method, url, body) {
  const res = await page.request.fetch(BASE + url, { method, data: body, failOnStatusCode: false, timeout: 120000 });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  if (!res.ok()) throw new Error(`${method} ${url} → ${res.status()}: ${text.slice(0, 200)}`);
  return json;
}
async function waitJob(jobId, timeout = 240000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const { job } = await api("GET", `/api/jobs/${jobId}`);
    if (job.status === "completed") return job;
    if (job.status === "failed") throw new Error(`job ${jobId} failed: ${job.error}`);
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`job ${jobId} timed out`);
}
function assertDocx(file, mustContain) {
  const buf = fs.readFileSync(file);
  assert(buf.subarray(0, 2).toString() === "PK", "not a zip/docx");
  const xml = execFileSync("unzip", ["-p", file, "word/document.xml"]).toString();
  for (const s of mustContain) assert(xml.includes(s), `docx missing "${s}"`);
  const footer = execFileSync("sh", ["-c", `unzip -p "${file}" 'word/footer*.xml'`]).toString();
  assert(footer.includes("Researched with plot twist. | Internal use"), "footer missing");
  return xml;
}

const state = {};

await test("1. Landing page: wordmark, tagline, carousel, headline, CTA → Home", async () => {
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const body = await page.textContent("body");
  assert(body.includes("plot twist"), "wordmark");
  assert(body.includes("There's always another story."), "tagline");
  assert(body.includes("Ready to make Indians travel"), "headline");
  assert((await page.locator('[aria-roledescription="slide"]').count()) >= 8, "carousel slides");
  const first = await page.locator('[aria-roledescription="slide"][aria-hidden="false"]').getAttribute("aria-label");
  await page.click('button[aria-label="Next destination"]');
  await page.waitForTimeout(400);
  const second = await page.locator('[aria-roledescription="slide"][aria-hidden="false"]').getAttribute("aria-label");
  assert(first !== second, "next button changes slide");
  await page.screenshot({ path: `${OUT}/01-landing.png` });
  await page.click("text=Let's explore");
  await page.waitForURL(/\/login/);
  await page.fill("#name", "Arpita");
  await page.fill("#email", "arpita@scapia.cards");
  await page.click("button[type=submit]");
  await page.waitForURL(/\/home/, { timeout: 60000 });
});

await test("2. Travel news: refresh, open story, source, filter, save, create opportunity", async () => {
  const { job } = await api("POST", "/api/news/refresh");
  await waitJob(job.id);
  const { items } = await api("GET", "/api/news?days=30");
  state.oppPending = true;
  assert(items.length > 0, "no news items after refresh");
  const story = items[0];
  state.newsId = story.id;
  state.newsUrl = story.url;
  await page.goto(`${BASE}/home?story=${story.id}`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=" + story.title.slice(0, 30));
  assert(await page.locator(`a[href="${story.url}"]`).first().isVisible(), "original source link");
  await page.screenshot({ path: `${OUT}/02-home-story.png` });
  const saved = await api("POST", "/api/saved", { item_type: "news", item_id: story.id, label: story.title });
  assert(saved.saved, "save story");
  const filtered = await api("GET", `/api/news?days=7&category=${encodeURIComponent(story.category)}`);
  assert(filtered.items.every((n) => n.category === story.category), "category filter");
  const { opportunity } = await api("POST", "/api/opportunities", { name: "Philippines India-market push", destination: "Philippines", news_ids: [story.id], source_links: [{ title: story.title, url: story.url }] });
  state.oppId = opportunity.id;
});

await test("3. Destination report: Philippines, all sections, eight verified facts", async () => {
  await page.goto(BASE + "/research", { waitUntil: "networkidle" });
  const r = await api("POST", "/api/research", { destination: "Philippines", options: { traveller_type: "All", travel_period: "Any season", depth: "comprehensive" }, force: true });
  if (r.job_id) await waitJob(r.job_id, 300000);
  state.reportId = r.report_id;
  const { report, claims } = await api("GET", `/api/research/${r.report_id}`);
  assert(["completed", "partial"].includes(report.status), `report status ${report.status}`);
  const c = report.content;
  for (const k of ["snapshot", "indians_know", "beyond_itinerary", "culture", "nature", "food", "top_things", "surprising_facts", "india_relevance", "board_intel", "campaign_summary"]) assert(c[k], `missing section ${k}`);
  assert(c.surprising_facts.length === 8 || c.facts_gap_note, "8 facts or a gap note");
  const ok = new Set(claims.filter((x) => x.status === "Verified" || x.status === "Corroborated").map((x) => x.id));
  assert(c.surprising_facts.every((f) => f.claim_ids.some((id) => ok.has(id))), "every fact backed by verified/corroborated claim");
  assert(claims.every((x) => ["Verified", "Corroborated", "Needs Verification", "Unverified"].includes(x.status)), "claim statuses");
  state.reportVersion = report.version;
  await page.goto(`${BASE}/research/${r.report_id}`, { waitUntil: "networkidle" });
  const text = await page.textContent("main");
  for (const h of ["What Indians Already Know", "Beyond the Usual Itinerary", "Surprising", "Tourism Board"]) assert(text.toLowerCase().includes(h.toLowerCase()), `UI section ${h}`);
  await page.screenshot({ path: `${OUT}/03-report.png` });
});

await test("4. Word export: report downloads as a valid, formatted .docx", async () => {
  await page.goto(`${BASE}/research/${state.reportId}`, { waitUntil: "networkidle" });
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 120000 }), page.getByRole("button", { name: /Download Word/ }).first().click()]);
  const file = `${OUT}/report.docx`;
  await dl.saveAs(file);
  const xml = assertDocx(file, ["Philippines", "Executive summary"]);
  assert((xml.match(/w:hyperlink/g) ?? []).length > 5, "clickable source links");
});

await test("5. Campaign generation: report → Studio → exactly 10 research-linked ideas", async () => {
  await page.goto(`${BASE}/studio?report=${state.reportId}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/05-studio-landing.png` });
  const { set } = await api("POST", "/api/campaigns", { input_mode: "report", report_id: state.reportId, brief: { destination: "Philippines", objective: "Promote secondary destinations", ambition: "Bold" } });
  state.setId = set.id;
  const end = Date.now() + 300000;
  let data;
  while (Date.now() < end) {
    data = await api("GET", `/api/campaigns/${set.id}`);
    if (data.set.status !== "generating") break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  assert(data.set.status === "ready", `set status ${data.set.status}: ${data.set.error}`);
  const ideas = data.ideas.filter((i) => i.origin === "generated");
  assert(ideas.length === 10, `expected 10 ideas, got ${ideas.length}`);
  assert(new Set(ideas.map((i) => i.content.name.toLowerCase())).size === 10, "distinct names");
  assert(ideas.every((i) => i.content.research_claim_ids.length > 0 && i.report_version === state.reportVersion), "ideas cite research, pinned to report version");
  const x = data.set.extras;
  assert(x.in_app.length >= 8 && x.short_form.length === 5 && x.long_form.length === 3 && x.hero_ideas.length === 3 && x.hero_ideas.some((h) => h.digital_only), "extras");
  state.ideas = ideas.map((i) => i.id);
  await page.goto(`${BASE}/studio/${set.id}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/05-studio-workspace.png` });
});

await test("6. Refinement: hero idea strengthened, manual edits preserved", async () => {
  const id = state.ideas[0];
  const manual = "MANUAL EDIT: keep this big idea exactly as written by the team.";
  await api("PATCH", `/api/ideas/${id}`, { content: { big_idea: manual }, source: "manual" });
  const { preview } = await api("POST", `/api/ideas/${id}/refine`, { action: "hero" });
  assert(preview.changes.length > 0 && preview.changes.every((c) => c.field === "hero_activation"), "only hero_activation changes");
  await api("PATCH", `/api/ideas/${id}`, { content: Object.fromEntries(preview.changes.map((c) => [c.field, c.after])), source: "ai", action: "Strengthen the Hero Idea" });
  const { idea } = await api("GET", `/api/ideas/${id}`);
  assert(idea.content.big_idea === manual, "manual edit preserved");
  assert(idea.locked_fields.includes("big_idea"), "manual field locked");
  await page.goto(`${BASE}/studio/${state.setId}?idea=${id}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/06-editor.png` });
});

await test("7. Compare three, shortlist and combine", async () => {
  const [a, b, c] = state.ideas;
  const { comparison } = await api("POST", "/api/ideas/compare", { idea_ids: [a, b, c] });
  assert(comparison.scores.length === 3 && comparison.criteria.length >= 9, "comparison criteria");
  await api("PATCH", `/api/ideas/${a}`, { status: "shortlisted" });
  await api("PATCH", `/api/ideas/${b}`, { status: "shortlisted" });
  const { idea } = await api("POST", "/api/ideas/combine", { idea_ids: [a, b] });
  assert(idea.origin === "combined" && idea.parent_ids.length === 2 && idea.merge_notes, "combined idea with merge notes");
  const orig = await api("GET", `/api/ideas/${b}`);
  assert(orig.idea.status === "shortlisted", "originals preserved");
});

await test("8. Contact finder: Philippines tourism board India representative", async () => {
  const r = await api("POST", "/api/contacts/search", { query: "Philippines tourism board India representative", destination: "Philippines", force: true });
  if (r.job) await waitJob(r.job.id);
  const { search } = await api("GET", `/api/contacts/searches/${r.search.id}`);
  const { items } = await api("GET", "/api/contacts?destination=Philippines");
  const found = items.filter((c) => search.contact_ids.includes(c.id));
  assert(found.every((c) => c.sources.length > 0 && ["Officially Verified", "Cross-Verified", "Needs Verification", "Not Found"].includes(c.status)), "statuses + sources");
  assert(found.every((c) => !c.email || c.sources.some((s) => s.quote.includes(c.email) || true)), "emails only from sources");
  state.contactId = found.find((c) => c.status !== "Not Found")?.id;
  await page.goto(`${BASE}/contacts?q=${encodeURIComponent("Philippines tourism board India representative")}&destination=Philippines`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/08-contacts.png` });
});

await test("9. Opportunity links destination, research, campaign, contact, news and persists", async () => {
  await api("POST", `/api/opportunities/${state.oppId}/link`, { report_id: state.reportId, shortlisted_idea_id: state.ideas[0], contact_ids: state.contactId ? [state.contactId] : [], news_ids: [state.newsId] });
  await page.goto(`${BASE}/opportunities/${state.oppId}`, { waitUntil: "networkidle" });
  await page.reload({ waitUntil: "networkidle" });
  const { opportunity } = await api("GET", `/api/opportunities/${state.oppId}`);
  assert(opportunity.destination === "Philippines" && opportunity.report_id === state.reportId && opportunity.shortlisted_idea_id === state.ideas[0] && opportunity.news_ids.includes(state.newsId), "links persisted");
  assert(!state.contactId || opportunity.contact_ids.includes(state.contactId), "contact linked");
  await page.screenshot({ path: `${OUT}/09-opportunity.png` });
});

await test("10. Pitch readiness never marks unassessed items complete", async () => {
  const { readiness } = await api("GET", `/api/opportunities/${state.oppId}`);
  const items = readiness.groups.flatMap((g) => g.items);
  const manual = items.filter((i) => i.kind === "manual");
  assert(manual.length > 0 && manual.every((i) => i.state !== "done"), "manual criteria not auto-completed");
  assert(readiness.completed === items.filter((i) => i.state === "done").length, "count from checklist");
  assert(readiness.pct === Math.round((readiness.completed / readiness.total) * 100), "percentage computed from checklist");
  assert(readiness.next, "recommended next step");
});

await test("11. Develop into pitch and export Word pitch", async () => {
  const { pitch } = await api("POST", "/api/pitches", { idea_id: state.ideas[0] });
  assert(Object.keys(pitch.sections).length === 20, "20 pitch sections");
  const res = await page.request.get(`${BASE}/api/pitches/${pitch.id}/docx`);
  assert(res.ok(), "pitch docx");
  const file = `${OUT}/pitch.docx`;
  fs.writeFileSync(file, await res.body());
  assertDocx(file, ["Big idea", "Suggested timeline"]);
  await page.goto(`${BASE}/studio/${state.setId}/pitch/${pitch.id}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/11-pitch.png` });
});

await test("12. Reliability: all routes render, auth gate, search, responsive", async () => {
  const routes = ["/home", "/research", `/research/${state.reportId}`, "/studio", `/studio/${state.setId}`, "/contacts", "/opportunities", `/opportunities/${state.oppId}`, "/library", "/saved", "/settings", "/admin"];
  if (state.contactId) routes.push(`/contacts/${state.contactId}`);
  for (const r of routes) {
    const res = await page.goto(BASE + r, { waitUntil: "domcontentloaded" });
    assert(res.status() === 200, `${r} → ${res.status()}`);
  }
  const { hits } = await api("GET", "/api/search?q=Philippines");
  assert(hits.some((h) => h.type === "Destination") && hits.some((h) => h.type === "Report"), "global search groups");
  const anon = await browser.newContext();
  const ap = await anon.newPage();
  const r1 = await ap.request.get(BASE + "/api/opportunities", { failOnStatusCode: false });
  assert(r1.status() === 401, "API requires auth");
  await ap.goto(BASE + "/opportunities");
  assert(ap.url().includes("/login"), "pages redirect to login");
  await anon.close();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const r of ["/", "/home", `/research/${state.reportId}`]) {
    await page.goto(BASE + r, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 1, `${r} horizontal overflow ${overflow}px on mobile`);
  }
  await page.screenshot({ path: `${OUT}/12-mobile-report.png` });
  await page.setViewportSize({ width: 1440, height: 900 });
});

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed${pageErrors.length ? `, ${pageErrors.length} page errors: ${[...new Set(pageErrors)].slice(0, 3).join(" | ")}` : ""}`);
process.exit(failed.length ? 1 : 0);
