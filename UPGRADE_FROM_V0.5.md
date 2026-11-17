# QASphere AI v0.6 — Upgrade from v0.5 (Windows / VS Code)

## What changed

The **CI/CD Pipeline** workspace can verify one named **GitHub Actions workflow**, associate a Jira ticket with the **exact branch**, observe build completion and **run local QA tests after a successful build**. Results are never fabricated: build success alone does **not** create a PASS. Failed/in-progress builds do not trigger QA. A new build marks previously tested cases `STALE`, revokes earlier local sign-off and, on success, starts a fresh QA run. Pending fixed defects close only when their related tests actually PASS.

GitHub operations are **read-only**. v0.6 does not push code, dispatch a GitHub workflow, deploy, merge, update Jira workflow, authenticate approvers, verify that the target environment contains the build's commit, or execute PROD tests. Do not use it as an enterprise release gate without security and integration reviews.

## Upgrade safely

1. Stop QASphere's running server: VS Code terminal → `Ctrl + C`.
2. Make a **backup copy** of `C:\Users\qamen\Downloads\qasphere-ai-starter`, including hidden `.env` and the `data` and `evidence` folders.
3. Extract `QASphere_AI_Starter_v0.6.zip` to a **different temporary folder**.
4. From the extracted `qasphere-ai-starter` folder, copy the **updated source code** to your existing working project, replacing old source files. Do **not** overwrite the existing `.env`; do not delete `data`, `evidence`, or `node_modules`; if you customized `config/db-checks.json`, preserve that file as well. The ZIP contains no `.env`, test history or screenshots.
5. Open the original project folder in VS Code, in **PowerShell** run:

```powershell
cd C:\Users\qamen\Downloads\qasphere-ai-starter
npm test
npm start
```

6. Browse to `http://127.0.0.1:4177` and hard-refresh with `Ctrl + Shift + R`. The sidebar must say **LOCAL PROTOTYPE · v0.6**. Existing test history remains where it was.
7. If `npm start` says a module is missing, and your network certificate trust is correctly configured, run `npm install --no-audit --no-fund` once, then `npm start` again. Do not disable TLS certificate verification.

## Configure the CI connection

Edit the **existing private `.env`** file and append (replacing these example strings with your own permitted repository and trusted CI workflow):

```dotenv
GITHUB_REPOSITORY=your-org/your-repo
GITHUB_TOKEN=YOUR_READ_ONLY_FINE_GRAINED_TOKEN
GITHUB_WORKFLOW=ci.yml
PIPELINE_POLL_SECONDS=0
```

For a private repository, the GitHub **fine-grained personal access token** should have access to that one repository with **Actions: Read**. GitHub Actions reads are done with the official `GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs` endpoint. Never put the token into QASphere's browser UI, Jira tickets, screenshots or ChatGPT messages.

**Important:** Choose the actual required *build/test* workflow file, e.g. `build-and-test.yml`, not a deployment workflow or unrelated workflow. Only one exact workflow is monitored in this release; multiple required workflows and protected branch approvals are not yet supported.

Restart the server after `.env` changes.

## Ticket-to-build testing

1. Go to **CI/CD Pipeline**. Verify repository and workflow show as configured (that is *not* a verified remote connection).
2. Under **Ticket → Git branch**, select a ticket such as `ABC-123` and enter the exact branch, e.g. `feature/ABC-123`. Select **Save ticket branch**.
3. In **Project Setup**, ensure the test target URL is the authorized **DEV/STG/SIT/UAT** application and test mappings are actually configured. Never point this tool at production.
4. Select **Check latest build & retest**. If GitHub returns a newly completed **success** build, QASphere will run this ticket's real mapped Playwright/API/DB cases. Unmapped test cases get `BLOCKED`; a successful build does not make them `PASS`.
5. A failed/cancelled/incomplete build blocks sign-off and does not trigger a retest. A subsequent successful build makes previous results stale and starts a new retest.
6. The same completed build will not trigger duplicate retesting. If a retest couldn't start (e.g. Chromium missing), fix the local prerequisite and click **Check latest build & retest** again.
7. Inspect ticket Test Cases, Recent executions, Defects, and the new **CI-CD Build** Excel export sheet.

### Automatic polling (optional)

Set `PIPELINE_POLL_SECONDS=120` or another integer **>= 60** in `.env` and restart QASphere. While the local app is running, it will periodically check **explicitly linked tickets** in the configured repository/workflow and start local QA when a new successful run is detected. Polling is off by default. It does **not** create or launch GitHub builds and cannot run when the PC/server is off.

## Limitations and safety

- No GitHub repository, workflow or token is bundled. A live GitHub Actions check **was not performed** while preparing this version. Unit tests use mocked remote responses.
- The current test target may differ from the commit that GitHub Actions built. v0.6 does **not** certify that code is deployed to your DEV/STG environment.
- There is no signed webhook, protected SSO, multi-tenant RBAC, true approver identity or release policy enforcement. The server binds to `127.0.0.1` and should not be made externally accessible.
- Local test runs may create test data in the permitted environment, depending on mapped browser actions. Map only approved QA test flows.
- A ticket's sign-off remains **Not ready** until all planned tests are mapped and freshly PASS, no defects remain open, and (for linked tickets) its latest successful CI build has a recorded QA retest.
