# Phase 4 handoff

Status: **Phase 4 validation passed on 9 October 2026 (IST); ready for user approval.** Stop here. Phase 5 has not started. Deadline remains 9 October 2026, 6:00 PM IST.

## Implemented

- Authenticated bounded user directory, directional contacts, membership-scoped conversation list/detail/history, canonical direct creation, and one transactional direct-message send service shared by REST and WebSocket.
- SQLite commits message, recipient receipt and conversation activity/version together. Sender UUID retries are idempotent; different content with the same UUID conflicts.
- One-use 30-second first-frame WebSocket tickets, exact Origin check, session/membership validation, 5-second authentication timeout, 64 KiB frame limit, one-worker connection registry and session logout cleanup.
- Version 1 `ready`, `message.send`, `message.accepted`, `message.created`, `conversation.updated`, ping/pong and correlated errors. Fresh REST state on ready/reconnect/resume; merge by server ID/client UUID.
- Existing Signal UI reads the signed-in user's data. Directory/add contact/New Chat/direct composer/pagination are connected. Group history remains read-only. Unread counts come from persisted receipts and are not cleared on opening a chat.
- `NEXT_PUBLIC_WS_URL` is a credential-free browser endpoint; REST `BACKEND_BASE_URL` remains server-only. Added pinned `websockets==17.2` for Uvicorn upgrades; no other dependency changes.
- Fresh history snapshots merge with current rows, preserving newer live/pending messages; server ID/client UUID remove duplicates. A real delayed-response regression test proves this ordering case.
- Message REST JSON has a 32 KiB cap so 4000 Unicode characters fit; ordinary auth/contact input retains its 8 KiB cap. Server validation still rejects text over 4000 characters.

## Final verification

| Working directory / command | Actual result |
|---|---|
| `frontend/`: `npm run lint` | Passed; zero warnings |
| `frontend/`: `npm run typecheck` | Passed; Next route generation + strict TypeScript |
| `frontend/`: `npm run build` | Passed; production routes compiled |
| `backend/`: `.venv\Scripts\python.exe -m pytest` | **60 passed**, 6.15 seconds |
| `backend/`: `.venv\Scripts\python.exe -m pip check` | No broken requirements |
| `frontend/`: `npx playwright test` | **24 passed**, 45.5 seconds; 12 desktop + 12 mobile; zero retries |
| Normal-port local startup/health | FastAPI 8000 + production Next 3000 started; direct and forwarded health both return `status:ok, service:scaler-signal-api` |

Runtime: Windows, Node 24.13.0, npm 11.6.2, Python 3.13.12, Playwright 1.64.0. Frontend lockfile/pins are retained; Python direct and complete resolved requirements both pin websockets 17.2. Existing Chromium worked; no browser installation was needed.

Backend coverage includes public-only directory fields, identity scoping, contact validation/idempotence, six concurrent canonical-pair requests, member-only detail/history/send, unknown IDs, persistence across app recreation, Unicode/newlines/4000-character boundary, UUID duplicate/conflict, recipient receipt rows and paginated history. WS coverage includes valid first frame, invalid/reused/expired tickets, invalid Origin, unauthenticated command, revoked session, nonmember send, Bob + secondary Alice socket delivery, and no Carol delivery.

Browser evidence uses real FastAPI 8100 + Next 3100 and a separately migrated/seeded temporary SQLite file. Alice sends via Enter with Shift+Enter newline; Bob receives without reload, replies, and both restore history after reload. Logout remains session-scoped. A fresh account starts empty and receives only its new direct thread. Contacts/search/unread, read-only group membership/history, keyboard menus/settings/dialogs, placeholders, mobile back navigation and health forwarding pass. Reconnect interrupts Alice's real socket, persists a Bob message while disconnected, then confirms one recovered history row. Another test delays a real REST snapshot until after a live message; the message remains exactly once. Fault controls alter timing/closure, not backend data.

QA viewports: 1280×800 and 390×844 for workflows; 1440×900, 1280×800, 1024×768 and 390×844 for capture/geometry. Page content and captures are nonblank with no framework error overlay. The directory/contact flow recorded no page errors; functional assertions pass throughout. No horizontal overflow was found; the composer remains at the viewport bottom. Browser plugin/skill was unavailable, so the explicitly required repository Playwright workflow was used.

Intermediate failures are preserved honestly: first Uvicorn browser attempt lacked a WS protocol package; adding the pin fixed it. Two earlier full runs were **15 passed / 5 failed** due to shared fixture counts, message/preview locator scope, hidden mobile controls and dialog scoping. These were corrected without deleting auth/health tests or weakening connected behavior. The original Phase 3 preview-only assertions were adapted to real data; keyboard/settings/placeholder coverage was retained. The delayed-snapshot test first reproduced a lost live row (1 failed), then passed on desktop/mobile after the merge repair. The first sandboxed pytest attempt errored/hung and was interrupted; approved execution outside that environment passed. The prior usage-limit approval-review failure ended the earlier attempt; resumed approval succeeded.

Terminal output still contains NO_COLOR/FORCE_COLOR notices and occasional Windows asyncio `WinError 10054` on browser connection teardown. They did not fail requests/tests. No warnings or failing assertions were suppressed.

## Files created or changed in Phase 4

```text
README.md
docs/PHASE_4_HANDOFF.md
backend/requirements.in
backend/requirements.txt
backend/app/__main__.py
backend/app/main.py
backend/app/realtime.py                         new
backend/app/routes/auth.py
backend/app/routes/conversations.py              new
backend/app/routes/socket.py                     new
backend/app/services/__init__.py                 new
backend/app/services/direct.py                   new
backend/tests/test_direct_phase4.py              new
frontend/.env.example
frontend/playwright.config.ts
frontend/lib/auth-gateway.ts
frontend/lib/chat-gateway.ts                     new
frontend/app/onboarding.tsx
frontend/app/globals.css
frontend/app/api/auth/ws-ticket/route.ts         new
frontend/app/api/users/route.ts                  new
frontend/app/api/contacts/route.ts               new
frontend/app/api/conversations/route.ts          new
frontend/app/api/conversations/direct/route.ts   new
frontend/app/api/conversations/[id]/route.ts     new
frontend/app/api/conversations/[id]/messages/route.ts  new
frontend/app/messenger/types.ts
frontend/app/messenger/primitives.tsx
frontend/app/messenger/sidebar.tsx
frontend/app/messenger/chat-pane.tsx
frontend/app/messenger/dialogs.tsx
frontend/app/messenger/messenger.tsx
frontend/app/messenger/use-chat-data.ts          new
frontend/tests/messenger.spec.ts
```

There is no Git repository in `D:\Scalar AI`, so this is the recorded Phase 4 file inventory, not a Git diff. PDF, the six Phase 0 documents, approval documents, Alembic 0001, models and seed were preserved. Fixture/visual primitives were reused; the fixture adapter is no longer authenticated conversation truth. No reset, automatic migration/seed, commit/push, deployment or paid resource was performed.

## Routes and events

REST: `GET /v1/users?query`, `GET/POST /v1/contacts`, `GET /v1/conversations?query&filter&cursor`, `POST /v1/conversations/direct`, `GET /v1/conversations/{id}`, `GET/POST /v1/conversations/{id}/messages`, `POST /v1/auth/ws-ticket`. Each has a fixed-operation Next `/api` route; mutations require configured Origin and current session CSRF. There is no generic proxy or browser-provided sender identity. Reads return 404 for a nonmember conversation; direct/group send misuse is rejected.

WS `/v1/ws`: first `auth` frame, `ready`, `message.send`, `message.accepted`, `message.created`, `conversation.updated`, ping/pong, correlated `error`, protocol `v:1`. Messages become sent only after database commit. New receipt rows are persisted, but new-message delivered/read state is not inferred from socket broadcast.

## Local review and screenshots

Use the root README's existing setup. In two PowerShell terminals:

```powershell
Set-Location 'D:\Scalar AI\backend'
.\.venv\Scripts\python.exe -m app

# Separate terminal
Set-Location 'D:\Scalar AI\frontend'
npm run start   # final production build exists; use npm run dev for development
```

Open http://127.0.0.1:3000. In two distinct browser profiles/incognito sessions, Log in as `alice` and `bob`, OTP `123456`, open each other's chat, exchange text, reload and select the chat again. Use 127.0.0.1 consistently. Server-only `.env` keys remain ignored; `NEXT_PUBLIC_WS_URL` is a credential-free endpoint and is read at frontend build time. Startup alone does not migrate or seed.

Local review servers were left running after validation (backend exec session 44662; frontend 66670). Stop each with Ctrl+C when finished. Stop Next before running another browser suite/build against the same `.next` directory.

Final captures are outside the repository:

- [Alice live exchange](C:/Users/HarshPC/.codex/visualizations/2026/10/08/01a11b98-36ec-7431-a3fd-6f185920e179/phase-4/desktop-alice-live.png)
- [Bob live exchange](C:/Users/HarshPC/.codex/visualizations/2026/10/08/01a11b98-36ec-7431-a3fd-6f185920e179/phase-4/desktop-bob-live.png)
- [Desktop direct 1440×900](C:/Users/HarshPC/.codex/visualizations/2026/10/08/01a11b98-36ec-7431-a3fd-6f185920e179/phase-4/desktop-direct-1440.png)
- [Desktop group 1440×900](C:/Users/HarshPC/.codex/visualizations/2026/10/08/01a11b98-36ec-7431-a3fd-6f185920e179/phase-4/desktop-group-1440.png)
- [Group details](C:/Users/HarshPC/.codex/visualizations/2026/10/08/01a11b98-36ec-7431-a3fd-6f185920e179/phase-4/desktop-members.png)
- [Settings](C:/Users/HarshPC/.codex/visualizations/2026/10/08/01a11b98-36ec-7431-a3fd-6f185920e179/phase-4/desktop-settings.png)
- [Mobile live exchange](C:/Users/HarshPC/.codex/visualizations/2026/10/08/01a11b98-36ec-7431-a3fd-6f185920e179/phase-4/mobile-alice-live.png)
- [Mobile list](C:/Users/HarshPC/.codex/visualizations/2026/10/08/01a11b98-36ec-7431-a3fd-6f185920e179/phase-4/mobile-list.png)
- [Mobile group](C:/Users/HarshPC/.codex/visualizations/2026/10/08/01a11b98-36ec-7431-a3fd-6f185920e179/phase-4/mobile-group.png)

The final group captures wait for loaded history. Visual approximations remain the ones approved for Phase 3; Phase 4 preserved that layout and avatar treatment.

## Remaining limits

- Broadcasts/tickets are in memory and require one worker/replica. Reconnect/resume REST reconciliation is tested; backend crash precisely between commit/publish and lost-ack combined REST/WS fault injection from advanced E07 were not run. UUID persistence/replay is tested independently; no guaranteed network delivery is claimed.
- Pending draft/UUID state is in component memory and survives a send failure/retry, not a full browser restart. Very large history UI/reading-position polish and lists beyond the first 50 returned conversations need later integration QA; backend pagination is tested. The connection caption is in the chat list, so mobile users return to the list to see it.
- Chromium/Windows are verified. Firefox, WebKit, deployed HTTPS/WSS and SQLite persistence across a Railway redeploy are untested.
- Original Phase 3 screenshot/reference approximations are unchanged. No new visual-reference approval is requested in this phase.

## Deferred and deployment gate

Phase 5 alone adds group mutations/sending, typing and live delivery/read acknowledgments. Presence and call/stories/settings placeholders remain explicit; no real encryption.

Railway's paid plan is available, but deployment is not performed. Future backend needs one worker/replica, `HOST=0.0.0.0`, Railway `PORT`, persistent volume with `DATABASE_PATH=/data/signal.sqlite3`, explicit migration/seed on that volume, matching server-only gateway key and exact HTTPS frontend Origin. Frontend needs a build-time `NEXT_PUBLIC_WS_URL=wss://<backend>/v1/ws` and server-only backend origin. Its local npm start binds loopback; Railway must explicitly start Next on `0.0.0.0` with its assigned port. Production domains, service/volume provisioning, mounted-volume migration/backup and persistence verification, public repository/push and deployment require the later approved deployment phase.

Recommended next prompt, proposal only: **Execute Phase 5 only: implement persistent group creation/admin membership/send, typing, and real delivered/read acknowledgments with the approved group history/receipt cohort rules; preserve Phase 4, test multiple sessions and authorization, and do not deploy.**
