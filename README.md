# QASphere AI v0.6 — Jira + Browser + API + SQL + CI/CD Build-to-Retest

**Local working-code prototype (not production software).** A Windows/Node.js dashboard that keeps a Jira ticket-centric QA matrix, inspects the *permitted* test application, proposes grounded browser mappings, executes Playwright assertions, captures screenshots, tracks defects/retests, exports Excel, and guards local sign-off.

## Existing v0.5 users — start here

See **UPGRADE_FROM_V0.5.md**. Preserve `.env`, `data/`, `evidence/`, `node_modules/`, and any customized `config/db-checks.json`. The new ZIP contains code files only. Stop `npm start`, merge the new project files into your existing working folder, then run:

```powershell
cd C:\Users\qamen\Downloads\qasphere-ai-starter
npm start
```

Browse to **http://127.0.0.1:4177**, refresh with Ctrl+Shift+R and confirm `LOCAL PROTOTYPE · v0.6`.

## New in v0.6

- **GitHub Actions CI/CD integration (read-only):** connect a repository and exactly one trusted workflow from private `.env`; link a Jira ticket to an exact branch in the new **CI/CD Pipeline** sidebar workspace.
- **Build-based QA retest:** detect a new successful GitHub Actions build and run local mapped Playwright/API/SQL test cases; new or failed builds invalidate old results and block local sign-off. No CI success is counted as a QA PASS.
- **Optional CI polling:** `PIPELINE_POLL_SECONDS >=60`; off by default. While the local server runs, periodically check explicitly linked tickets and retest on fresh successful builds.
- **Excel:** new CI-CD Build sheet with build status, SHA, run URL, local retest run ID.
- **Security:** read-only GitHub token; no workflow dispatch, Git push, PR, merge, deployment, PROD testing, verified identity or Jira workflow transitions. CI build success does not prove the corresponding commit is deployed on the test target.

See **UPGRADE_FROM_V0.5.md** and **CHANGELOG_V0.6.md** for setup and exact limitations.

## Existing v0.5 SQL capabilities (preserved)

- **SQL Server (read-only):** approved SELECT checks with parameter binding, strict TLS and real connection validation. Results integrate into ticket PASS/FAIL/BLOCKED and test history; no arbitrary SQL from Jira or the browser.
- **Sync assigned to me:** read-only Jira Cloud search for open issues assigned to the API-token owner, with pagination and optional polling.
- **API testing:** same-origin GET checks using `apiGet`, `assertApiStatus`, and `assertApiJson`. Results appear in the normal report and defect/retest workflow.
- **Map demo API** on EDU-101: maps a bundled read-only validation fixture, **not the real Guardian backend**.
- **API-only execution without Chromium:** browser tests still require Playwright.

See **UPGRADE_FROM_V0.5.md** for Windows upgrade steps and **CHANGELOG_V0.5.md** for complete release notes.

**Example API mapping** (authorized DEV/STG origin, not PROD):

```json
[
  {"action":"apiGet","url":"/api/health"},
  {"action":"assertApiStatus","value":"200"},
  {"action":"assertApiJson","selector":"status","value":"ok"}
]
```

The GET URL must be on the configured test app origin and cannot follow redirects. An optional bearer token is read from private `.env` as `TEST_API_BEARER_TOKEN`. Never paste secrets into mapped steps or chat. These tests confirm only their actual assertions, not complete feature or database correctness.

## New installation

Requires Node.js 20+, Windows/PowerShell and permission to install packages. Extract ZIP, open `qasphere-ai-starter` in VS Code and run:

```powershell
Copy-Item .env.example .env
npm install --no-audit --no-fund
npx playwright install chromium
npm start
```

The browser is downloaded **one time only**, not on each startup. If npm fails with `SELF_SIGNED_CERT_IN_CHAIN`, configure the trusted corporate CA or use a compatible Node.js `NODE_USE_SYSTEM_CA=1` mechanism; **do not disable certificate verification**.

## First demonstration — one-click ticket testing

1. **Project Setup:** set `Test application URL` to `http://127.0.0.1:4177/sample-app/` and `Environment` to `DEV`. This included sample site is local and not connected to a customer.
2. **Sprint & Tickets → EDU-101:** click **Smart Auto Test**, or use the `AUTO TEST` button next to EDU-101 in the ticket table.
3. QASphere examines DOM element IDs/selectors and maps only well-grounded tests: **Smoke**, **Positive booking**, **Negative empty-name validation**, **Regression (cancel flow)**. It then uses Playwright for actual assertions.
4. Read PASS/FAIL/BLOCKED and screenshot evidence. **10 remaining categories are intentionally not auto-mapped**; the test plan is not sign-off ready.
5. Click **Analyze app** to see candidate steps and decomposed acceptance checks without running. Select individual proposed mappings and choose **Approve selected mappings** to save them, then **Run mapped only**.
6. Click **Export Excel** for test cases, runs, defects, approvals, smart analysis and acceptance checks.

**Important:** `http://127.0.0.1:4177` (without `/sample-app/`) is the QASphere dashboard, *not* the Guardian demo. You must not test EDU-101 against the dashboard and interpret heading visibility as booking success. Smart Auto Test protects against this target mismatch.

## Real Jira issue → browser analysis

1. Have an authorized Jira Cloud service account. Configure its base URL, email and token in your **private `.env`**, not in the browser or chat. Optional board ID and polling seconds are supported.
2. Restart QASphere. From **Project Setup**, choose **Check Jira connection now**. Configured does not mean verified.
3. In **Sprint & Tickets**, paste a Jira issue key/URL or select the active sprint. Confirm the actual description/acceptance criteria imported.
4. Under **Project Setup**, choose the *authorized* DEV/STG application URL. Production automated execution is disabled. The browser is restricted to requests on the configured origin.
5. Click **Analyze app**. Generic pages get only a **safe structural smoke proposal** if a visible heading can be observed; it is not functional acceptance testing.
6. For broader proposals, optionally configure `OPENAI_API_KEY` and click **AI suggest steps**. This calls an **external API service** and may incur separate API charges; ChatGPT Plus does not supply an API key. Explicit confirmation is required before ticket criteria and bounded UI metadata are sent. No entered field values are collected.
7. AI suggestions must use selectors present in the observed DOM, pass bounded step validation and be **approved locally** before mapping. Review risk of creating appointments or changing test data. Then execute with **Run mapped only**. Tests with no approved mapping stay `BLOCKED`.
8. Defect/retest cycle: Playwright failures create local defects. Mark a defect fixed after developer work, rerun; a verified PASS closes a pending retest. Jira issue creation is opt-in in `.env` and must not be enabled without authorization.

## Truthful execution semantics

- `PASS`: Playwright successfully performed the **configured actions and assertions**, not proof that every requirement was tested.
- `FAIL`: An executed assertion/action failed; see actual error and screenshot.
- `BLOCKED`: No executable mapping, invalid environment, or insufficient setup; **never interpreted as PASS**.
- `STALE`: Prior results invalidated by a change to requirements, test target or environment.
- Sign-off checks still require all planned tests mapped/current PASS, acceptance criteria and no unresolved defects; recording an approver **name is not identity verification** and **does not update Jira status**.

## Existing features preserved

Jira REST issue/active sprint sync, 14 QA categories, browser step editor, Smoke auto-discovery, local defect assignment/retests, optional AI drafting, code *proposal* in developer workspace (not deployment), local audit log, Excel export, configurable DEV/STG/SIT/UAT target and environment, and user-controlled local attestation.

## Not yet delivered

General-purpose autonomous browser agents that can infer all business workflows, SSO and authenticated role switching, automatic SQL schema mapping/SQL write tests, Git PRs/code fixes/CI dispatch or deployments, Jira workflow transitions, multi-tenant/role-based authentication, trusted release approvals, production deployment and enterprise-grade protection. An authorized human must remain responsible for approvals and non-test actions.

This app binds to `127.0.0.1` and must **not** be exposed to the Internet. `.env` holds credentials; `data/` may contain private Jira text, mappings and test history; `evidence/` may contain screenshots; keep them local and private.

## Build checks

```powershell
npm test
```

Also see `CHANGELOG.md` and `ROADMAP.md`. Key files: `server.js`, `lib/smart.js` (discovery/AI guard), `lib/smart-plan.js` (grounded pure mapping), `lib/runner.js` (Playwright execution), `lib/workflow.js` (sign-off and invalidation), `lib/jira.js` (Jira), `lib/report.js` (Excel), `public/app.js` (UI).

## v0.5 SQL Server pilot

A SQL connection is **not automatic**. Configure an authorized, **read-only DEV/STG SQL Server login** in private `.env`, review `config/db-checks.json`, and click **Project Setup → Check SQL connection now**. This is a genuine connection probe and fails if unavailable. Use **Map steps** on a Database test to reference an approved check by ID, not to submit SQL from a ticket. See **UPGRADE_FROM_V0.5.md** for a parameterized booking-count mapping example and first-run directions.

**Safety/accuracy:** An SQL Server health check alone does not validate guardian booking. An approved business query and an actual assertion against the real permitted database are necessary. Database mismatches FAIL, unavailable configuration BLOCKS. No actual SQL Server or private GitHub repository was accessible for integration testing during packaging.
