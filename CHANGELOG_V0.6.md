# v0.6.0 — CI/CD build verification and automatic QA retest

Added:
- New **CI/CD Pipeline** workspace and per-ticket exact Git branch linking.
- Read-only GitHub Actions workflow run lookup: one trusted workflow file from `.env`, bound to the permitted repository and linked branch.
- Optional local polling (`PIPELINE_POLL_SECONDS >=60`, off by default) to watch linked tickets for new runs.
- On new completed-success build: invalidate old test results, run current mapped QA checks, record local run ID and CI SHA; unmapped cases remain BLOCKED.
- On failed, cancelled, or pending build: no automatic test execution; local sign-off blocked and prior results invalidated on new status.
- Duplicate-build checks do not rerun tests; manual retry supported if a previously attempted local retest errored.
- Existing tests, defect/retest, sign-off, SQL Server, API and Playwright workflows retained.
- `CI-CD Build` sheet added to Excel export.
- Five new GitHub Actions and build-gate unit tests plus dashboard UI coverage.

Not delivered: CI run dispatch, code editing/PRs, production deployment, verified Jira sign-off, environment commit attestation, enterprise security/authentication, live GitHub/SQL integration verification, or autonomous execution of unmapped user journeys.

Security: GitHub token read from local `.env`, never sent to browser. Use a repository-scoped **Actions: Read** fine-grained token. `api.github.com` is the only GitHub REST destination; no user-supplied URLs are fetched. No GitHub write methods are implemented.
