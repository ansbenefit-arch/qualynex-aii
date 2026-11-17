# Upgrade v0.1 → v0.2 (Windows / VS Code)

## Safest option: merge code, keep your existing installation

1. In your **current** VS Code terminal that is running `npm start`, press **Ctrl+C** to stop the old server.
2. In File Explorer, go to `C:\Users\qamen\Downloads`. Make a **backup copy** of the entire `qasphere-ai-starter` folder, e.g. `qasphere-ai-starter-backup`.
3. Download `QASphere_AI_Starter_v0.2.zip` and **Extract All** to `C:\Users\qamen\Downloads`. Confirm **Replace the files in the destination** for QASphere source files. This ZIP has the same root folder name `qasphere-ai-starter` to merge safely into the existing folder. If extracting somewhere else first, copy the new source files from its `qasphere-ai-starter` folder over the old one.
4. Your existing `.env`, `data/state.json`, `node_modules`, `evidence/`, and `generated/` are **not in the ZIP** and should remain in place. Do **not** copy these from a stranger or share them.
5. In VS Code PowerShell, run:

```powershell
cd C:\Users\qamen\Downloads\qasphere-ai-starter
node -v
npm start
```

6. Open `http://127.0.0.1:4177`, hard-refresh if needed with **Ctrl+Shift+R**. Look for `LOCAL PROTOTYPE · v0.2` in the left sidebar.
7. Run `EDU-101 → Run mapped only`, inspect the test results, and check `Export Excel`.

**No new npm dependencies were added in v0.2.** If v0.1 already ran successfully, your existing `node_modules` and Playwright Chromium installation should continue to work; there is no need to download them again.

## If `npm start` says `Cannot find module ...`

You might have extracted into a different folder without its dependencies. Return to your original installed folder, or run `npm install --no-audit --no-fund` inside the new folder. A missing Chromium error can be fixed by `npx playwright install chromium` **in that folder**. Never disable HTTPS security to work around corporate certificate errors.

## Rollback

Stop the server and restore your `qasphere-ai-starter-backup` folder. Keep your private original `.env`, `data/`, and `evidence/` backed up separately before changing installations.

## Important compatibility note

Existing test cases and run history remain stored in `data/state.json`. v0.2 introduces `STALE` when ticket requirements or environment change. Re-generating a ticket's test matrix resets its prior manual mappings and test results, so export your existing Excel report first if you need it for audit.
