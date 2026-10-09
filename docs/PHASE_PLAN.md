# Approval-gated plan and risks

> **HISTORICAL — original approval-gated plan.** The application is built, deployed and verified; the plan and original next-phase prompt below are retained as history, not outstanding work. Railway deployment was explicitly authorized early, followed by groups/receipts/typing, visual QA, reactions, profile/search polish and final documentation. See the [current README](../README.md) and [final verification](FINAL_VERIFICATION.md). Owner submission remains manual; deadline: **9 October 2026, 18:00 IST**.

Original Phase 0 status: documentation delivered for review; implementation was not yet authorized. Initial workspace contained only AGENTS.md and the four-page assignment PDF. All phase transitions require a new explicit user instruction.

## Dependency order and completion gates

Retain requested order: **0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7**. UI reference approval is an additional prerequisite for Phase 3. Host feasibility decisions happen now; actual deployment remains Phase 7. Prepare testing infrastructure in Phase 1 and add checks with each feature, rather than postponing correctness testing until Phase 6. Phase 4 defines receipt-compatible payloads/schema but leaves full receipt/typing behavior to Phase 5.

| Phase | Authorized work when separately requested | Dependencies / affected paths | Exit gate |
|---|---|---|---|
| 0 Requirements/architecture/reference | Six requested design documents, PDF traceability, evidence and approval questions. | `docs/` only; source PDF and rules read-only. | User reviews design decisions; missing reference evidence remains explicitly open. |
| 1 Scaffold and test harness | Minimal Next.js/TS and FastAPI projects, health endpoint, configuration examples, ignore rules, lint/type/build scripts, pytest + Playwright harness, basic smoke checks. Pin compatible versions. | Approval of Phase 0 architecture. `frontend/`, `backend/`, root config/README skeleton. | Both services start locally; real health/harness smoke passes; lint/type/build/backend tests pass. No auth/chat/database features or designed chat UI. |
| 2 Database/auth/seed | Models/migrations, session/challenge/auth APIs, preset profile fields, repeatable seed and authorization helpers. Minimal functional onboarding forms; no final Signal shell. | Phase 1. `backend/` model/migration/auth/seed/tests; `frontend/` session/REST/onboarding. | E01-E02/E12 seed portion; fresh migrate and repeat seed; persistence, expiry/revocation and DB constraints verified. Minimal auth forms are a web-specific adaptation, pending final visual QA. |
| 3 Signal layout/static UI | Approved sidebar/chat/empty/composer/search/menu/modal/settings states with static fixtures; original components and tokens. Static data is confined to this phase's UI fixtures. | Phase 2 **and explicit visual-reference approval**. `frontend/` components/styles/fixtures and visual test evidence. | Desktop comparisons corrected across approved states; narrow-screen QA recorded. Demonstrate states as static mocks, not functioning messaging. |
| 4 Contacts/direct APIs + WS | Contacts, canonical direct conversations/history, authenticated socket tickets, real send/receive, send idempotency, sorting/preview, reconnect/resync and core UI wiring. | Phases 2-3. `backend/` routes/services/ws/tests; `frontend/` data/hooks/chat wiring. | E03-E04/E07/E08 plus relevant E10 checks across Alice/Bob/Carol. Committed messages durable and unauthorized access denied. Full delivery/read/typing remains explicitly pending Phase 5. |
| 5 Groups/receipts/typing | Group membership/admin APIs and UI, send-time recipient rows, acknowledgment states/unread, group fanout, multi-tab typing. | Phase 4. Backend/frontend corresponding modules and tests. | E05-E06/E09-E10, including concurrent removal/send, offline recipients and negative authorization. All core flows work end to end. |
| 6 Integration and pixel-level QA | Full acceptance run, error/loading/empty states, reference overlays, layout corrections and regressions. | Phase 5 + complete approved reference set. Frontend/backend fixes and test artifacts. | E01-E11/local E12 pass; no remaining mandatory failures or unreviewed visual deviations. Bonuses only if separately authorized after this gate. |
| 7 README/deployment/final E2E | Final README, setup rehearsal, hosting configuration, backup/restore and durability test, public repository and hosted demo, final two-session E2E and submission URLs. | Phase 6; provider/budget approved; explicit approval before remote commit/push, publication/deployment or paid resource creation. Root README/config and deployment documentation. | E12 fully passes, hosted E01-E11 applicable checks pass; actual test results and working URLs supplied; interview walkthrough ready. |

The PDF's approximately 24-hour effort estimate is not a promised schedule. Deadline has not been supplied. If time is tight, eliminate all bonuses first; do not mock mandatory receipt/group/persistence behavior or skip visual approval to claim completion.

## Five largest risks

| Risk | Consequence | Mitigation / evidence gate |
|---|---|---|
| 1. Visually generic UI or inconsistent references | Fails explicit Signal similarity criterion despite functional chat. | Freeze one Windows/light reference set, derive measurements, compare every agreed state in Phases 3 and 6. R1 alone is cropped; obtain missing captures. Avoid redesign templates and decorative additions. |
| 2. Unauthorized data access | Guessed IDs or stale sockets expose private chat data. | Shared session/membership checks on all routes/events, immutable sender identity, Origin/CSRF controls, transaction-scoped member checks, removal queue cleanup, Alice/Bob/Carol negative tests in E08/E09. Mock OTP does not excuse missing authorization. |
| 3. SQLite storage loss or write contention in hosting | Data vanishes on deploy or requests fail under concurrent writes. | Paid durable volume or verified existing VM, one backend worker/instance, short WAL transactions, busy timeout, backups/restore, restart/redeploy proof in E12. Never place authoritative DB on free ephemeral disk. |
| 4. Cross-client event gaps, duplicates, or false receipts | Sender sees success while recipient loses messages; stale unread/typing persists. | Commit before acknowledgment, stable client UUIDs, per-user multi-socket fanout, explicit delivered/read acks, buffered REST reconciliation, periodic repair, TTL typing, race/reconnect tests E04-E07/E09. |
| 5. Core unfinished because of scope/time growth | Attractive shell lacks required groups/auth/receipts or usable submission. | Trace every mandatory ID to E01-E12; gate phases; maintain a visible core-defect list; defer all bonuses, real cryptography, media/calls; reserve Phase 7 for setup/hosting checks. Confirm deadline and budget early. |

## Decisions for user approval

1. Username-only mock OTP onboarding and preset avatar selection; All/Unread filter and in-app toasts; no mandatory uploads or real phone service.
2. Database-backed opaque sessions in first-party HttpOnly cookies, thin Next.js REST forwarding, one-use first-frame WS tickets, single FastAPI worker/instance, SQLAlchemy/Alembic, REST repair on reconnect.
3. New group members can see full history; removed members lose server access; original receipt cohort is retained. Group status uses all-recipient aggregation; final admin cannot remove themself.
4. Windows/light candidate baseline and five missing-state captures before Phase 3; mobile baseline QA versus full responsive bonus distinction.
5. Hosting recommendation/budget: Vercel frontend subject to Hobby eligibility + paid Render backend/disk; Railway is an alternative. Exact Render quote, region, account eligibility, backup retention, and evaluation availability window remain unresolved. No paid resource or deployment approval is inferred.

## Phase 0 verification record

- Read local AGENTS.md in full with `Get-Content`; inventoried workspace with `rg --files` (initially two input files).
- Used bundled Python `pypdf.PdfReader` to extract all four pages, then `pdftoppm -scale-to 1200 -png` and inspected each rendered page. All four were readable; no assignment screenshots found. Temporary renders were inspection artifacts, not deliverables.
- Browsed first-party Signal, hosting and technical documentation; visually inspected official Windows PNG in browser. No local implementation screenshot exists and no UI fidelity test has been claimed.
- Produced the six requested Markdown documents; checked file presence, local links and scenario/requirement coverage. Application lint/type/build/backend/E2E commands are not applicable: there is no scaffold and installation/implementation is prohibited in Phase 0.
- Deliberately deferred: every app feature, dependency installation, reference approval, production writes, repository publication and deployment.

## Recommended single next-phase prompt

> Proceed with Phase 1 only: scaffold and test harness, using the Phase 0 architecture and scope proposals. Inspect AGENTS.md and the six docs first, list the plan and affected paths, create minimal Next.js + TypeScript and FastAPI projects, configuration examples and meaningful pytest/Playwright smoke checks, and run lint, typecheck, frontend build and backend tests. Report actual results and stop at the Phase 1 gate. Do not implement auth, database, seed, chat UI, contacts, messaging or groups, and do not commit/push, deploy or create paid resources. Visual-reference approval remains pending and must be resolved before Phase 3.
