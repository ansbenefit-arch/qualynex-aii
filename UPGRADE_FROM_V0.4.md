# Upgrade QASphere AI v0.4 -> v0.5 (Windows / VS Code)

## Preserve your project data

1. In VS Code, press `Ctrl + C` in the terminal running `npm start`.
2. Make a backup of `C:\Users\qamen\Downloads\qasphere-ai-starter` (copy the whole folder, including its hidden `.env`).
3. Extract `QASphere_AI_Starter_v0.5.zip` into a **separate** directory.
4. Copy the extracted new code into your existing `qasphere-ai-starter` folder. Overwrite existing source files; keep your existing `.env`, `node_modules/`, `data/` and `evidence/` directories. Do **not** replace your working `.env` with `.env.example`.
5. In a new VS Code **PowerShell** terminal run:

```powershell
cd C:\Users\qamen\Downloads\qasphere-ai-starter
$env:NODE_USE_SYSTEM_CA = '1'
npm install --no-audit --no-fund
npm test
npm start
```

Open http://127.0.0.1:4177 and press `Ctrl + Shift + R`. Verify the sidebar shows **LOCAL PROTOTYPE · v0.5**.

`npm install` adds the optional `mssql` SQL Server driver; the usual browser/API demo works without a SQL connection. If the SQL driver is reported missing, run `npm install mssql@12.7.14 --save` once and restart. Do **not** use `npm config set strict-ssl false` to work around a corporate CA error.

## Configure SQL Server (optional; for real DB assertions only)

1. Ask your database administrator for a **dedicated SQL login with SELECT-only permission on approved DEV/STG tables/views**, a known database hostname and a valid TLS server certificate. Never use the application administrator account.
2. Edit your private `.env` in VS Code to add `SQLSERVER_HOST`, `SQLSERVER_DATABASE`, `SQLSERVER_USER`, `SQLSERVER_PASSWORD`, and optionally `SQLSERVER_PORT`. See `.env.example`; never paste secrets into Jira tickets, the dashboard or chat.
3. Review `config/db-checks.json`. Only `sql-connectivity` is provided by default and it merely proves a read-only query succeeds. To validate a business requirement, add a separately approved `SELECT` query there with fixed SQL and named parameters. `config/db-checks.example.json` shows a **schema example only** (it cannot run without adapting to your actual DB schema).
4. Restart the app. Open **Project Setup → Check SQL connection now**. “Configured (unverified)” is not a successful connection.
5. In **Sprint & Tickets**, choose the issue's **Database** test → **Map steps**. Paste a mapping that matches a check configured by your administrator. Example, after a corresponding `booking-count-by-student` query is approved and installed:

```json
[
  {"action":"dbQuery","checkId":"booking-count-by-student","params":{"studentName":"TEST_STUDENT_001"}},
  {"action":"assertDbValue","selector":"booking_count","value":"1"}
]
```

6. Click **Save mapping**, then **Run**. PASS means only that the configured SQL query and assertion succeeded on the connected non-production database. A mismatch becomes FAIL; a missing SQL driver, connectivity error or unavailable approved check becomes BLOCKED. One DB assertion is not full acceptance coverage.

## Protection and limits

- SQL text comes from **locally reviewed config**, never from imported Jira text or a browser field. Only bounded single-statement SELECT checks are supported. `@parameters` are sent as driver-bound values. SQL Server **SELECT-only database permissions are required**; syntactic checks alone do not secure a database.
- Real TLS validation is mandatory. No self-signed certificate bypass, no production executions, no arbitrary SQL edit UI, no automatic table discovery, no write queries.
- Local `data/state.json` can store mapped parameter values: use synthetic test data, not passwords, confidential student names or personal information. Reports include mapped steps and therefore parameters; screenshots and Jira text may also contain private information.
- Connection check and driver behavior were tested through mocks, but **no real SQL Server instance was available during packaging**. Verify your own approved SQL Server connection before relying on results.
- Existing Jira import, UI/API execution, local defect cycle, Excel reports, and human sign-off controls are retained.
