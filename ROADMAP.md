# QASphere AI roadmap (updated v0.6)

**Current implemented:** local Jira ticket/assigned/sprint sync, 14 draft QA categories, Smart Auto Test for DOM smoke + isolated demo workflows, reviewable AI mapping candidates, Playwright screenshots, read-only same-origin API tests, allowlisted SQL Server checks, GitHub Actions read-only build verification and mapped local QA retest, defect/retest loop, Excel, local sign-off gate.

**Next priorities (not yet implemented):** trusted authentication and secrets storage, robust Jira OAuth/integrations, safe isolated test data, semantic UI exploration with explicit role/credential vault, broader API/DB adapters, auditable autonomous repair proposals, multi-workflow CI policies, authenticated CI and Jira approvals. No universal automatic functional testing is claimed.

---

# QASphere AI — Target Enterprise Architecture

## Product outcome

**Jira ticket arrives → context is synchronized → AI drafts acceptance-focused test scenarios → test plan is validated → non-production automation executes → real evidence is recorded → defects are filed and routed → developer fixes in isolated branch → CI runs → QA re-tests → approved sign-off → release workflow transition.**

**No manual typing** is a useful target for routine steps, not a guarantee for unknown requirements, MFA/SSO, CAPTCHAs, unscriptable behavior, ambiguous acceptance criteria, security-sensitive code or regulatory sign-off. A safe system explicitly reports `BLOCKED`, `NEEDS_INFO`, `NEEDS_REVIEW` and other non-pass states.

## Required modules for the full product

1. **Multi-tenant Identity**: SSO/OIDC, org/project isolation, RBAC, immutable audit trails, human approver identities, regional data residency, least-privilege permissions.
2. **Onboarding**: organization, project, business domain, environment (DEV/SIT/STG/UAT/PROD), role workspace, optional SQL Server or other DB connector, optional ticketing/SCM/pipeline integration, encrypted persisted state, connection validation.
3. **Issue ingest**: Jira Cloud/Server + Azure DevOps + ServiceNow + GitHub/GitLab issues; webhook/poll; comment/attachments/custom fields/links/sprints; assignee/sprint/state delta tracking; dedupe + retries.
4. **QA intelligence**: requirement parsing, ambiguity detection, scenario generation, risk ranking, coverage mapping and traceability for positive, negative, boundary, smoke, sanity, functional, regression, integration, E2E, UI, API, DB, accessibility, security, performance, cross-browser, localization, SIT/UAT, exploratory, load/stress/soak; skip irrelevant types with reasons.
5. **Test execution workers**: Playwright web, Appium mobile, API collection runner, SQL read-only connectors, message queue, mock/stub services, accessibility tools, contract tests, performance workers. Per-company private agents deployed behind firewall when required. Selector detection, agentic repair suggestions, retries with flakiness detection and evidence diffing. Never silently classify a test PASS.
6. **Developer agent**: repository indexing, code language adapters, branch + patch generation, local/static tests, PR review, secure CI runner, vulnerability/dependency/license scans, human approval for risky changes.
7. **Defect loop**: normalized error triage, evidence/screenshots/video/network logs, Jira bug creation, correct ownership via project rules, fix detection via commits/webhooks, scoped + regression retest, SLA and escalation.
8. **Release controls**: configurable approval gate, tester sign-off, approver sign-off, coverage requirements, release reports, policy-based Jira transitions (SIT/UAT/Ready for Release), rollback strategies and evidence retention.
9. **Platform operation**: Postgres for tenant data; Redis/queue; object storage for evidence; background event workers; secrets manager; encrypted credential vault; observability, backups, SOC2/ISO27001 readiness, cost controls, idempotency and rate-limit handling.
10. **Integrations/extension API**: versioned connectors and plugins for any programming language, SCM, CI/CD, database and test framework; document support matrix rather than claiming universal integration.

## Implementation phases and honest status

- **v0.1 — Prototype:** local dashboard, mapped demo browser tests, Jira issue/sprint reading, 14 scenario drafts, Excel, local bug and sign-off records, developer proposals.
- **v0.2 — Delivered local pilot:** validated test-step mapping in the UI, heading-based smoke auto-discovery, Jira connection check and Agile pagination repair, requirement-change invalidation, stronger local defect-retest/sign-off rules, richer Excel and faster startup. **Not enterprise-ready** and does not authenticate people.
- **v0.3 — Early browser-analysis pilot delivered, full enterprise plan not delivered:** authenticated accounts; scoped Jira OAuth; webhooks; safe credential handling and trusted test accounts; API contract + read-only database testing; Git branch/pull-request integration, CI run dispatch and approvals.
- **v0.4 — API connector pilot delivered, broader agent workflow still planned:** issue triage → task decomposition → reviewed test designs → selector mapping suggestions → sandboxed execution → triage and PR suggestions; authenticated role-based approvals for Jira/CI transitions, controlled notifications.
- **v1 — Planned enterprise deployment:** multi-tenancy, private workers, SSO, formal audit/security review, secrets vault, policy engine, reliability, observability, scalable job queue and environment release governance.

The above enterprise capabilities are **not promises of shipped behavior in v0.6**. Every automated action needs real credentials, connectivity, permissions, application-specific context, and policy constraints.

## Sample role-specific screens

- **Tester**: sprint queue, each issue has TEST; test traceability, run states, screenshots, bugs, retest, coverage, Excel, sign-off readiness.
- **Developer**: assigned Jira issues, repo status, create-code proposal, build/pipeline state, patch review, defects and reruns.
- **Production**: release candidate quality gates, deployment pipeline status, change approvals, smoke verification, rollback reporting. Deployment never silently starts without approved policy.

## Governance / safe defaults

Project owners authorize testing of their sites and accounts. Require allowlisted domains, non-production defaults, masked credentials, data retention, no mass edits without review, authenticated approvals, explicit consent for Jira writes and code merges, and immutable provenance of each PASS/FAIL decision.

## v0.4 delivered (November 2026)

Read-only Jira assigned-ticket sync and optional polling, same-origin GET API response assertions, bundled demo API fixture, and API-only tests without Chromium. Full customer integration remains unverified.

## v0.5 suggested priorities

Authenticated RBAC, secrets vault, OpenAPI-based mapping, read-only SQL verification, acceptance-criteria coverage, durable test jobs, and permissioned Git/CI and Jira transitions.

## v0.6 delivered (November 2026)

- Read-only GitHub Actions integration for one exact repository/workflow, explicit Jira-ticket-to-feature-branch links, periodic polling (optional), new build invalidation, successful CI build → actual local mapped Playwright/API/DB QA retest, and Excel build provenance.
- A green CI build never means a green QA test. Failed builds do not trigger browser execution. Linked tickets require an associated local retest before sign-off.
- The app does NOT build code, open PRs, verify a deployment matches the CI commit, execute tests on production, authenticate approvers, transition Jira issues or promote a release.

**v0.7 suggested:** protected multi-workflow release policy and deployment SHA attestation, authenticated connectors/users, durable job queue, audit evidence, and consent-controlled Git PR proposal workflow.
