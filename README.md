# plot twist.

*There's always another story.*

An internal travel-intelligence, destination-research, campaign-ideation and tourism-partnership platform for the marketing and tourism partnerships team.

**Discover an opportunity → research the destination → generate campaign ideas → develop a pitch → find tourism-board contacts → track the opportunity.** Every stage links to the next without re-entering information.

---

## What's inside

| Route | Page | What it does |
|---|---|---|
| `/` | Landing | Cinematic destination carousel (licensed Wikimedia Commons photography), headline, CTA |
| `/home` | Travel Intelligence | Live news (RSS + search), featured stories, filters, India Outbound Watch, opportunity signals, weekly digest, watchlists |
| `/research`, `/research/[id]` | Destination Research | Sourced 11-section reports run as durable jobs, claim-level citations, research health, versions, Word export |
| `/studio`, `/studio/[id]` | Campaign Studio | 10 research-linked concepts plus extras, three-panel editor, AI refinement that protects manual edits, compare, combine, versions, comments, pitches with Word export |
| `/contacts`, `/contacts/[id]` | Tourism Board Contacts | Live contact discovery, deterministic verification, outreach drafts (never sent) |
| `/opportunities`, `/opportunities/[id]` | Opportunity Tracker | Table and Kanban views, linked evidence and work, activity log, transparent Pitch Readiness checklist |
| `/library` | Campaign Library | Real reference campaigns with sources; "Use as Inspiration" sends the mechanism to the Studio |
| `/saved`, `/settings`, `/admin` | User data and administration | Saved items, profile, integrations, feeds, limits, users and roles, usage, jobs, audit log |

### Credibility rules built into the code

- **No fabricated facts.** Research, news and contacts only use retrieved sources. The model proposes a claim with a verbatim quote, and `lib/evidence.ts` checks that the quote really appears in the retrieved text.
- **Status is derived, never AI-asserted.** A claim is *Verified* only if found in a primary source (government or tourism board), *Corroborated* if found in 2+ independent domains, *Needs Verification* if found in one non-official source, and *Unverified* otherwise.
- **Research health is computed from stored evidence.** That covers evidence %, unresolved claims, stale claims (per-type freshness policy in `lib/freshness.ts`) and source coverage.
- **Contacts:** a name and title must appear in a cited source. Emails and phone numbers are kept only if printed in a source. LinkedIn links are kept only if returned by search. Nothing is guessed.
- **Every surface labels its content** as a Verified fact, a Strategic interpretation or a Creative hypothesis.
- **External text is untrusted.** It is sanitised and fenced for prompt-injection defence (`lib/security/content.ts`), and it is never treated as instructions.
- **Missing integrations show a setup state**, not fake results.

---

## Quick start (local)

Requirements: Node 20.18+.

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

Open http://localhost:3000.

- **Without Supabase**, data is stored in `.data/` (JSON files), and sign-in is a local signed-cookie form (name + work email, restricted by `ALLOWED_EMAIL_DOMAINS`). The first user becomes admin.
- **Without OpenAI or a search key**, research, news search, campaign generation and contacts show a clear "Setup needed" state.

### Offline demo mode (development only)

To exercise every workflow without API keys, set `PLOT_TWIST_DEMO_FIXTURES=true`. AI and search are then replaced by fixtures that:

- are labelled `[DEMO]` everywhere
- use the reserved `.invalid` domain
- are flagged `is_demo`

Demo data is never real information and is ignored in production builds.

---

## Configuration

All keys are listed in [`.env.example`](.env.example). Secrets are only read server-side (`src/lib/env.ts`); the browser only receives on/off integration status.

| Integration | Variables | Notes |
|---|---|---|
| Database + auth | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Switches the store to Postgres and sign-in to Google Workspace |
| Access control | `ALLOWED_EMAIL_DOMAINS`, `ADMIN_EMAILS`, `SESSION_SECRET` | Domain allow-list; first user / listed emails become admin |
| AI | `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_CREATIVE_MODEL` | JSON output validated with Zod, one repair retry. Admins can override the model in `/admin` |
| Search | `TAVILY_API_KEY` (recommended) or `BRAVE_SEARCH_API_KEY` | Needed for live research, news search, contacts and library re-verification |
| Photos | none (Wikimedia Commons), optional `UNSPLASH_ACCESS_KEY` | Only CC0 / CC BY / CC BY-SA / public-domain photos, with attribution stored |
| Scheduler | `CRON_SECRET` | Bearer token for `/api/cron/*` |

### Supabase setup

1. Create a project and run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) in the SQL editor, or use `supabase db push`.
2. **Authentication → Providers → Google:** enable it with a Google Workspace OAuth client.
3. **Authentication → URL configuration:** add `https://<your-domain>/auth/callback` (and `http://localhost:3000/auth/callback`) as redirect URLs.
4. Set the three Supabase variables plus `ALLOWED_EMAIL_DOMAINS` (for example `scapia.cards`).

Roles (`admin`, `editor`, `viewer`) live in the `profiles` table and can be changed in `/admin → Users`:

- **Viewers** can read and save.
- **Editors** can create and edit.
- **Admins** also manage settings, feeds, users and jobs.

The server uses the service-role key and checks roles in `lib/auth` and `lib/api.ts` on every route. Row-level security restricts any direct client access to signed-in internal users.

---

## Research jobs

Long-running work (destination reports, contact discovery, news refresh, campaign generation) runs as **durable jobs** (`src/lib/jobs`).

- Each job's status (`queued → finding_sources → extracting_facts → verifying → generating_report → completed / failed`) and log are persisted in `research_jobs`. The UI polls them, with no fake percentages.
- Jobs start after the HTTP response using Next.js `after()`.
- `/api/cron/jobs` (every 15 minutes) resumes queued or stalled jobs, up to 3 attempts. Failed jobs can also be retried from `/admin`.
- `/api/cron/news` refreshes news every `news_refresh_hours` (default 24 to stay within the free Tavily tier; configurable in `/admin`).

**Cost controls:**
- **Report caching:** reports are reused within `report_cache_days`, and re-running the same destination and options offers the cached report.
- **Duplicate detection:** for contact searches and campaign briefs.
- **Daily limits and rate limits:** daily research and AI limits per user, plus burst rate limits.
- **Usage tracking:** recorded in `usage_events` and viewable in `/admin`.

---

## Deploying to Vercel

1. Import the repository in Vercel (Next.js preset).
2. Add the environment variables from `.env.example`. Use the production URL for `NEXT_PUBLIC_APP_URL`.
3. Deploy. [`vercel.json`](vercel.json) registers the two cron jobs, and Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is set.
   - On the Hobby plan, crons can run at most daily. Change the schedules or upgrade for 8-hourly news and 15-minute job recovery.
4. Configure Supabase as above. The local `.data` store is not used when Supabase is configured, and is not suitable for serverless production.

Long jobs need a function duration that fits comprehensive research (several minutes). The cron worker sets `maxDuration = 300`; raise your plan's limit if needed.

---

## Testing

```bash
npm run typecheck
```

```bash
npm test
```

`npm test` runs unit tests: content security, quote verification, news classification, contact verification and pitch readiness.

End-to-end tests (the 12 workflows in the spec) run against a dev server with demo fixtures and need Playwright:

```bash
npm i -D playwright && npx playwright install chromium
```

```bash
PLOT_TWIST_DEMO_FIXTURES=true PLOT_TWIST_DATA_DIR=.data-e2e npx next dev -p 3100
```

In a second terminal:

```bash
BASE_URL=http://localhost:3100 npm run test:e2e
```

The suite covers:

1. Landing page and CTA
2. News refresh, story, source, filter, save and opportunity creation
3. Philippines report with all sections and eight evidence-backed facts
4. Word report export
5. 10 research-linked campaigns
6. Hero refinement that preserves manual edits
7. Compare and combine
8. Contact finder with statuses and sources
9. An opportunity linking destination, research, campaign, contact and news, persisting after reload
10. Readiness that never auto-completes unassessed items
11. Word pitch export
12. Routes, the auth gate, global search and mobile overflow

Screenshots are saved to `tests/e2e/output/`.

---

## Project structure

```
src/
  app/                 routes (landing, (app)/* internal pages, api/*)
  components/          ui kit, shell, brand, sources (citations), feature components
  data/                seed: destinations, reference campaigns, outbound stats
  lib/
    ai/openai.ts       structured generation (Zod-validated JSON)
    search/            Tavily / Brave
    images/            Wikimedia Commons / Unsplash with licence handling
    evidence.ts        source storage, deterministic claim verification, research health
    research/ news/ campaigns/ contacts/ opportunities/ library/
    export/            Word documents (docx)
    jobs/              durable job runner + handlers
    db/                store interface: Supabase (production) and local JSON (development)
    security/          content sanitising, safe URLs, rate limits
supabase/migrations/   Postgres schema + RLS
tests/                 unit + e2e
```

## Seed data and its limits

- **Destinations:** 15 directory entries. Tourism-board websites are marked unverified unless confirmed.
- **Campaign Library:** 14 real reference campaigns with source links. They start as **Needs Verification**, because seed research could only read search-result snippets. Use **Re-verify** with a search key configured.
- **India Outbound Watch:** starts empty unless `src/data/outbound-stats.json` holds sourced figures. Editors add statistics through a form that requires value, unit, period, definition, geography, publisher and source.
- **News, reports, contacts and campaigns:** generated only by live research. No production content is pre-filled.

*Internal use. Researched with plot twist.*
