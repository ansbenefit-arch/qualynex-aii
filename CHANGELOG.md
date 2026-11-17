# QASphere AI change log

## v0.3.0 — Smart Browser Pilot

**Implemented**
- `Smart Auto Test` button next to sprint tickets and inside ticket details: read-only DOM discovery, safe mapping, Playwright run, evidence and defect recording.
- Real application analysis limited to structural smoke; known sandbox demo supports grounded Smoke, Positive, Negative and Regression mappings when required selectors are actually present.
- Acceptance criteria decomposed into individual traceability checks; reviewable candidate mappings shown on the dashboard.
- Optional AI mapping suggestions restricted to selectors observed on the application page, with explicit third-party data transfer confirmation and manual approval before execution.
- New endpoints `/api/tickets/:key/smart-analyze`, `/smart-apply`, `/smart-run`.
- New Excel sheets `Smart Analysis` and `Acceptance Checks`.
- Changes to requirements, target URL or environment invalidate prior results/analyses; local sign-off remains blocked unless every planned case is mapped, currently passed, and defects closed.
- Existing v0.2 installation and state can be retained; no additional Node packages required.

**Not implemented / not claimed**
- A general autonomous browser agent for arbitrary Jira acceptance criteria.
- Validated real Jira write actions, SQL Server integration, business API tests or code repair/deployment.
- Enterprise authentication or verified human sign-off.

**Validation completed here:** 13 standalone unit/UI tests passed, and all JavaScript files passed syntax checks. No full Playwright browser run was possible in this build environment because npm packages and network were unavailable; test on a Windows machine with dependencies installed.
