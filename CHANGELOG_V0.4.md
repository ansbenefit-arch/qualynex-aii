# QASphere AI v0.4 — Release notes

- **Assigned Jira work:** Jira Cloud `/rest/api/3/search/jql` enhanced search, assigned-to-token-owner JQL, `nextPageToken` pagination, capped at 500 issues per sync; optional read-only polling with `JIRA_SYNC_MODE=assigned`.
- **HTTP API testing:** Same-origin GET `apiGet` step plus `assertApiStatus` and `assertApiJson` assertions. These participate in ticket execution results, defect/retest, readiness and Excel report.
- **Security:** No cross-origin API calls or redirects, strict 12-second timeout, 128 KB response limit, optional server-side bearer token, no API response body written to run history.
- **No Chromium for API-only runs**; Playwright remains required for browser tests.
- **Demo API:** EDU-101 `Map demo API` checks bundled validation fixture `200` / `422`. This is not the real Guardian scheduling API.
- **Excel report:** Run History now identifies API, Browser, Mixed, or Unmapped mode.
- **Existing behavior preserved:** No fake PASS; unmatched cases BLOCKED; requirements changes invalidate results; Jira defect writes opt-in and sign-off remains local.
- **No new npm dependencies.** Existing `.env`, `data`, `evidence`, `node_modules` should be preserved during upgrade.

**Not implemented:** Real customer integration validation, direct SQL Server tests, autonomous code changes, Git/CI actions, real Jira transitions, SSO/RBAC, authenticated sign-off or automated production release.
