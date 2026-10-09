# Phase 5 handoff — 9 October 2026

Status: implementation and local validation complete. The owner's resumed instruction explicitly authorizes commit/push, deployment to the existing Signal services and public multi-user/persistence QA. No new migration, seed, volume reset, resource provision or billing change is needed. Branch `main`, starting HEAD `67b9ff5abf43f8bc16fd7d3f1e239169ae1a7d1e`. User-created `PHASE_4_DEPLOYMENT_APPROVAL.md` preserved. Deployment results will be recorded separately after actual public checks.

## Implemented

- A: shared direct/group transactional send, stable UUID deduplication, send-time receipt cohorts, commit-before-publication. Group create/name/admin rename/add/remove; deduplicated existing members; max 100; final-admin protection; direct membership immutable. Removed users lose connected events, history and send access. Rejoin/full history preserves original receipt rows.
- B: own-recipient atomic delivered/read REST acknowledgments, read implies delivered, idempotent monotonic timestamps, cross-chat/nonmember denial, all-original-recipient group aggregation. Real client delivery; read requires selected, rendered, visible message elements. Stored read state drives unread and filtering; selected chat survives disappearing from the unread list. Status merges cannot regress. Reconnect/foreground/30-second repair covers loaded older receipts and multi-page gaps.
- C: WS typing with per-connection aggregation, two-second coalescing, five-second expiry, stop/blur/switch/logout/disconnect cleanup, membership filtering and no SQLite/activity changes. Genuine nonselected incoming-message toasts, deduplicated real-event replay, no own/history toasts.
- Preserved Phase 3 layout; existing rename form styling reused; typing occupies its own line above the composer to avoid mobile bubble overlap. No new dependencies or migration; schema revision remains 0001.

## Contracts

New REST below `/v1` (matching fixed Next `/api` routes): POST `/conversations/groups` (`name,user_ids`); PATCH `/conversations/{id}` (`name`); GET/POST `/conversations/{id}/members` (POST `user_ids`); DELETE `/conversations/{id}/members/{user_id}`; POST `/conversations/{id}/delivered` and `/read` (`message_ids`, max100). Authenticated identity is always server-owned, mutations retain Origin/CSRF and gateway requirements. Receipts reject an entire invalid batch without partial updates.

New WS version-1 events: client `typing.set` with conversation and `{typing:boolean}`; server `typing.changed` with aggregated `user_ids` and expiry hint; `receipt.updated` with the committed public message; content-free `membership.removed`. Existing direct message events/routes remain. Receipts are sent through REST, not an additional WS command implementation. Public message payload adds original `recipient_ids`, `delivered_ids`, `read_ids`.

## Completed local verification

- Full backend `.venv/Scripts/python.exe -m pytest`: **78 passed**, 8.15 seconds. `.venv/Scripts/python.exe -m pip check`: no broken requirements.
- Final full `npx playwright test`: **32 passed**, 2.1 minutes, desktop and mobile Chromium. Installed Chromium reused, no browser installation required.
- Final `npm run lint`, `npm run typecheck`, `npm run build`: **all passed**, including the history recovery and conversation-search fixes; production build generated all fixed API routes.
- Checkpoint A: 9 backend checks, 2 group E2E passed. Checkpoint B: 12 backend checks, 4 group/receipt E2E passed. Checkpoint C after pool fix: 6 desktop/mobile E2E passed. Multi-page recovery final targeted run: 2 passed, 29.1 seconds.
- Tests run real FastAPI8100/Next3100 against new migrated/seeded OS-temp SQLite files; separate Alice/Bob/Carol contexts, Dave outsider, no developer/production data. Browser plugin not available; repository Playwright/installed Chromium used. No browser install required.
- Backend coverage includes 100-member limit, concurrent send/removal, new/removed/rejoining recipient cohorts, forged/cross-chat acknowledgments, read-implies-delivered, historical timestamps, sender's second socket, typing TTL/multitab and 24 concurrent acknowledgments with zero retained pool connections.

## Failures found and repaired

1. Sandbox pytest initially had 9 temporary-directory setup errors, not application failures; approved local execution outside the sandbox passed.
2. First full browser run: **29 passed / 1 failed**. Mobile reload stalled under a receipt burst. Auth request sessions held connection-pool slots while waiting on the mutation lock, and synchronous socket authorization reads blocked the event loop. Mutation routes now release the loaded auth connection before waiting; socket checks run in a threadpool. A 24-concurrent-ack regression and focused browser rerun pass. No pool size increase, test skip or timeout masking.
3. Multi-page recovery first run: **1 passed / 1 failed** (mobile showed51/56 messages). Recovery initially tracked REST-loaded boundaries only; live/committed messages now also establish the oldest-known boundary. Final targeted desktop/mobile recovery passes all56 messages and the older read receipt.
4. Next full browser run: **31 passed / 1 failed**. Opening conversation search before history loaded called `.filter` on an absent array. The dialog now treats pending history as empty and tolerates unknown sender names. The existing test deliberately holds the real history response until search opens, then releases it and checks the actual result. Final full suite: **32 passed**.
5. Actual screenshot review corrected unstyled nested rename input and mobile typing overlap. Existing Node NO_COLOR/FORCE_COLOR and intermittent Windows socket-close WinError10054 notices remain unsuppressed; no passing request is inferred from those warnings.

## Production gate and evidence

Local screenshots and final log `playwright-resumed.log` are under `C:/Users/HarshPC/.codex/visualizations/2026/10/08/01a11b98-36ec-7431-a3fd-6f185920e179/phase5/` outside Git. Captures cover real groups/admin, delivered/read and typing at desktop1280×800 and mobile390×844; existing layout captures include1440×900. The browser plugin is unavailable; regular Playwright provides isolated multi-user contexts, with the available in-app browser used for public inspection.

Security review: group and receipt writes validate active membership again within the serialized transaction; only admins modify membership; only the authenticated original recipient can acknowledge. Batch validation is atomic, direct membership immutable, last admin protected. Next routes are fixed allowlisted operations and preserve Origin/CSRF; cookie/ticket contracts and startup volume validation are unchanged. No dependency, schema or production variable changes.

Next authorized actions: stage only source/docs/tests; verify no secrets/env/databases/artifacts; push one verified commit; monitor both existing deployments; verify public group/admin/typing/unread/receipts/direct flows and exact message IDs after backend restart. Keep `/data` and all other projects unchanged. Stop after the Phase 5 deployment review.

## Deliberately deferred / limits

No real encryption; OTP is public123456. Calls/stories/linked devices/presence/settings preferences remain documented placeholders; attachments/reactions/replies/dark mode/disappearing messages remain out of scope. Chromium/Windows local verification only; Firefox/WebKit are untested. Full reference/pixel review is Phase6, not claimed complete by this phase. Pending unsent drafts are memory-only. No durable socket event log; reconnect and periodic REST repair are the recovery mechanism. One worker/replica remains mandatory.
