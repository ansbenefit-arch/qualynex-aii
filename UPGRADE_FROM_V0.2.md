# Upgrade QASphere AI v0.2 → v0.3 (Windows / VS Code)

Your working project is likely `C:\Users\qamen\Downloads\qasphere-ai-starter`.

**Keep your existing state and secrets.** This package does not contain `.env`, `data/`, `evidence/` or `node_modules/`.

1. In VS Code, stop the existing `npm start` server with **Ctrl+C**.
2. Back up the whole `qasphere-ai-starter` folder or at least `.env`, `data/`, `evidence/` and all project source files.
3. Download `QASphere_AI_Starter_v0.3.zip` and extract it **to a different folder**, not inside your old project.
4. Open the extracted `qasphere-ai-starter` folder. Copy the **contents** of its `lib`, `public`, `tests` folders plus `server.js`, `package.json`, `start-windows.bat`, `README.md`, `CHANGELOG.md`, `ROADMAP.md` and new upgrade documents to the corresponding locations in your original working folder. Confirm replacement of existing **source code** files. Never replace or delete your original `.env`, `data`, `evidence`, or `node_modules`.
5. Open a new PowerShell terminal in the **original** project folder:

   ```powershell
   cd C:\Users\qamen\Downloads\qasphere-ai-starter
   npm start
   ```

6. Browse to `http://127.0.0.1:4177`, then use **Ctrl+Shift+R** to refresh. The sidebar must display `LOCAL PROTOTYPE · v0.3`.
7. Under **Project Setup**, check the test URL for the bundled demo: `http://127.0.0.1:4177/sample-app/` — do not use the QASphere dashboard root for the `EDU-101` booking demo.
8. Choose **Sprint & Tickets → EDU-101 → Smart Auto Test**. Expect browser-verified Smoke, Positive, Negative and Regression checks if the local demo loads; other categories remain unmapped/BLOCKED. Run outcomes can vary, and this demonstration is not sign-off ready.

`npm install` is **not normally needed** when upgrading a working v0.2 installation (dependency versions are unchanged). If modules are missing, run `npm install --no-audit --no-fund`, then `npx playwright install chromium` once. On managed networks, configure trusted CA correctly; do not turn off TLS verification.

## v0.3 workflow

- **Smart Auto Test**: inspect the configured permitted page, auto-map structural smoke and the bundled demo's known workflows, run the browser cases and record screenshots. Generic real applications are **not** fully automated.
- **Analyze app**: read-only DOM discovery; preview safe candidate steps and acceptance-check decomposition without executing tests.
- **AI suggest steps**: appears only when `OPENAI_API_KEY` is configured. It sends ticket criteria and selected DOM labels/selectors to the configured external AI provider after UI confirmation. It produces **review-required proposals**, not verified tests. An API account is distinct from a ChatGPT subscription.
- **Approve selected mappings**: local, unauthenticated review action. After review, choose **Run mapped only**. Only an actual Playwright assertion can produce PASS/FAIL.
- **Export Excel**: now includes `Smart Analysis` and `Acceptance Checks` sheets.

## Known limits

No universal webpage agent, automatic login/SSO, SQL or API execution, repository patches, CI/CD orchestration, authenticated approval, Jira transitions, or production execution. Real Jira requirements require an authorized connector. A smoke PASS can only validate the specific heading asserted, not the entire ticket.
