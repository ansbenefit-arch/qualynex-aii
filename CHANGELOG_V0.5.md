# QASphere AI v0.5 — SQL Server Read-Only Checks

## Added

- SQL Server connection configuration through `.env` with encryption and certificate validation.
- Local *approved-check catalog* (`config/db-checks.json`) with read-only, single SELECT statement validation. No raw ad hoc SQL accepted via HTTP API.
- `GET /api/db/catalog` exposes only IDs/descriptions/parameter names, never SQL or secrets.
- `POST /api/db/check` executes a live read-only connection probe; the dashboard distinguishes configured from verified.
- Two test mapping actions: `dbQuery` for an approved parameterized check and `assertDbValue` for its returned first-row field.
- SQL-only runs without Chromium/Playwright launch; no SQL driver/network or unavailable approved check produces `BLOCKED`, not artificial PASS.
- Redacted DB assertion errors (actual database cell values are not stored in execution messages).
- Windows upgrade guide with secret/data preservation and SQL Server least-privilege requirements.

## Existing unchanged

Jira assigned issue and sprint sync, Browser/Playwright, same-origin GET API assertions, demo EDU-101 test flows, smart DOM analysis, existing test history, defect/retest, local sign-off safeguards and Excel exports.

## Verification

31 Node `node:test` checks pass for core features and new SQL Server paths, including a **mock SQL driver**. This does **not** prove actual connectivity to a user's SQL Server. No full application browser integration was run in the packaging environment.

## Not yet implemented

Automatic acceptance-to-SQL query generation, live schema discovery, database write tests, enterprise secrets vault, SSO, Git-based code editing, production Jira workflow transitions, comprehensive browser/DB end-to-end validation.
