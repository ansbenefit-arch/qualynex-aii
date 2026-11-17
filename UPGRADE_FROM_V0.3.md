# QASphere AI v0.3 -> v0.4 — Windows / VS Code

**Back up your v0.3 folder first.** Do not delete your `.env`, `data/`, `evidence/`, or `node_modules/`. These runtime folders and secrets are not included in the v0.4 ZIP.

1. Stop the existing `npm start` terminal using **Ctrl+C**.
2. Copy `C:\Users\qamen\Downloads\qasphere-ai-starter` to a backup folder.
3. Download and extract `QASphere_AI_Starter_v0.4.zip` to a separate location.
4. Copy **source files** from the extracted `qasphere-ai-starter` into your existing project, allowing replacement of matching source files. **Do not overwrite** your original `.env`, `data/`, `evidence/`, or `node_modules/`.
5. In VS Code PowerShell:

   ```powershell
   cd C:\Users\qamen\Downloads\qasphere-ai-starter
   npm start
   ```
6. Visit http://127.0.0.1:4177 and press **Ctrl+Shift+R**. Confirm **LOCAL PROTOTYPE · v0.4** in the sidebar.

No new npm packages are required if v0.3 already runs. If a dependency is missing: `npm install --no-audit --no-fund`. Browser tests may require `npx playwright install chromium`, but API-only tests do not launch Chromium.

## First v0.4 test (no Jira account required)

1. **Project Setup:** set Environment to `DEV` and Test application URL to `http://127.0.0.1:4177/sample-app/`.
2. **Sprint & Tickets -> EDU-101 -> Map demo API**.
3. Run **EDU-101-TC-08** using its **Run** button. The demo API fixture is checked for a valid `200` result and a missing-name `422` result, including JSON assertions.
4. Export Excel and inspect the API run. **This is a bundled fixture, not the real Guardian Portal backend or a created booking.** Other tests remain NOT_RUN/BLOCKED until actually tested.

## Real Jira: Assigned to me

1. Use an approved Jira Cloud account. In your **private local `.env` only**, configure:

   ```dotenv
   JIRA_BASE_URL=https://your-site.atlassian.net
   JIRA_EMAIL=your-approved-account@example.com
   JIRA_API_TOKEN=YOUR_OWN_JIRA_TOKEN
   ```

2. Restart the server. In Project Setup click **Check Jira connection now**.
3. In Sprint & Tickets choose **Sync assigned to me**. This imports open issues assigned to the account owning the token, **without changing Jira**.
4. Optional automatic polling: add `JIRA_SYNC_MODE=assigned` and `JIRA_POLL_SECONDS=120` to `.env` and restart. Set polling seconds to `0` to disable.
5. Where Jira acceptance criteria are in a custom field, set `JIRA_ACCEPTANCE_FIELD=customfield_XXXXX`.

Never paste tokens into a chat or dashboard input. Jira scope and access must be authorized by your organization.

## Real non-production API mapping example

Under a ticket's API test case, choose **Map steps**, edit the JSON and save:

```json
[
  {"action":"apiGet","url":"/api/health"},
  {"action":"assertApiStatus","value":"200"},
  {"action":"assertApiJson","selector":"status","value":"ok"}
]
```

Configure a permitted DEV/STG application origin in Project Setup and replace path/assertions with real contract expectations. GET requests are same-origin, do not follow redirects, and reject oversized responses. For authorized bearer-protected DEV APIs, optionally set `TEST_API_BEARER_TOKEN` in the private `.env` and restart; never paste the token into test steps. **GET endpoints should be approved for testing and confirmed to be read-only.**

## Limits

This is a localhost pilot with no user login or multi-tenant permissions. It does **not** automatically implement tickets, patch code, test arbitrary applications, connect SQL Server, or transition Jira workflow status. Sign-off is local and cannot verify identity. Production execution is blocked. Full Express/Playwright integration could not be tested in the build environment. Do not expose the server to the Internet.
