# Scaler Signal assignment

**Phase 4 validated, awaiting approval:** authenticated contacts, own conversations/history, direct-thread creation and persistent live direct messaging are connected to the approved Signal-inspired UI. **60 backend tests and 24 Playwright tests pass**, along with lint/typecheck/build and pip check. Group history is readable; group sending/management, typing and live delivery/read acknowledgments remain Phase 5. See [Phase 4 handoff](docs/PHASE_4_HANDOFF.md) and the preserved [Phase 3 visual QA](docs/PHASE_3_VISUAL_QA.md).

**Deadline: Friday, 9 October 2026, 6:00 PM IST (12:30 UTC).** This user-confirmed date supersedes historical “unknown deadline” notes in the preserved Phase 0 docs.

This is an interview assignment, not an official Signal client. **OTP is public and impersonable: use fictitious data only. There is no real end-to-end encryption.**

## Prerequisites and installation

Verified on Windows: Node **24.13.0**, npm **11.6.2**, Python **3.13.12**. Runtime hints: `.nvmrc`, `.python-version`. No global framework CLI or venv activation is required.

From your actual checkout (here `D:\Scalar AI`), PowerShell:

```powershell
Set-Location 'D:\Scalar AI\backend'
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m app.configure_local
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m app.seed

Set-Location 'D:\Scalar AI\frontend'
npm ci
npx playwright install chromium
```

`configure_local` explicitly creates ignored `backend/.env` and `frontend/.env` with a shared random gateway key. It prints no key, preserves existing matching files, and refuses to overwrite partial/mismatched configuration. On an existing checkout, reuse the venv and local environment files. If `.env.local` already exists, review it: Next gives it precedence over `.env`. Safe names/defaults are in each `.env.example`; auth needs matching nonempty `INTERNAL_API_KEY` values, at least 32 characters. Never use `NEXT_PUBLIC_` for that key or the backend REST URL.

Migrations and seeds never run during ordinary startup. No reset command is provided. Preserve the SQLite file and its WAL/SHM sidecars; do not delete them to fix an error.

Dependencies are exact pins: frontend `package.json` + `package-lock.json` (`npm ci`), backend direct `requirements.in` + fully resolved `requirements.txt`. Existing frontend packages were retained: Next 16.4.0, React 19.3.0, TypeScript 5.9.3, ESLint 10.12.0, Playwright 1.64.0. Phase 2 adds **SQLAlchemy 2.1.4 and Alembic 1.20.0**, with Mako 1.4.3 and MarkupSafe 3.0.4 transitively. FastAPI 0.143.0/Uvicorn 0.54.0 remain unchanged. Tests use pytest 9.1.1 and Starlette's current `httpx2` 2.13.1 TestClient dependency.

Phase 4 adds only **websockets 17.2**, pinned in both Python requirement files, so Uvicorn supports browser WebSocket upgrades. Existing Chromium is reused; no browser reinstall is required.

## Local servers and demo flow

Keep two PowerShell terminals open:

```powershell
# Backend, one worker
Set-Location 'D:\Scalar AI\backend'
.\.venv\Scripts\python.exe -m app
```

```powershell
# Frontend
Set-Location 'D:\Scalar AI\frontend'
npm run dev
```

Open [onboarding](http://127.0.0.1:3000). Use **Register**, a new username (3–32 ASCII letters/numbers/underscores), a display name (1–80 characters), an original Sky/Fern/Sun/Clay avatar, and **OTP 123456**. Usernames normalize to lowercase; display names are trimmed. Registration signs you in. Reload restores the persisted session; **Settings → Profile → Log out** revokes it. Use **Log in** with `alice`, `bob`, `carol`, or `dave` and **123456** after seeding. Registration and login are distinct operations.

Use separate browser profiles or an incognito window for Alice and Bob. Alice opens Bob's existing chat; Bob opens Alice's. Enter sends, Shift+Enter inserts a newline. Both see the live exchange; refresh and select the thread again to verify saved history. New Chat searches the public demo directory and opens an existing or new direct thread; New Contact adds a directional contact. A fresh account starts with no chats. New sends remain **sent** after commit; opening a chat does not clear persisted unread state yet.

Local browser WebSockets connect directly to `ws://127.0.0.1:8000/v1/ws`. `frontend/.env.example` documents `NEXT_PUBLIC_WS_URL`; configure it before a build for a different backend. No credential is placed in this URL.

Use **127.0.0.1 consistently**; do not mix it with localhost. Frontend [health forwarding](http://127.0.0.1:3000/api/health/live) obtains the real [FastAPI health response](http://127.0.0.1:8000/v1/health/live):
`{"status":"ok","service":"scaler-signal-api"}`.
[FastAPI API docs](http://127.0.0.1:8000/docs) describe backend contracts, but credential-bearing auth routes require the server-only gateway key. Use the app for login rather than exposing that key to a browser tool.

Stop servers with Ctrl+C. To review a production build locally, use `npm run build` then `npm run start`. Do not run Next dev and production servers against the same `.next` directory simultaneously. Browser tests use Next dev and can replace build artifacts; rebuild afterward before `npm run start`.

Portable POSIX setup substitutes `python3.13 -m venv .venv` and `.venv/bin/python` for the Windows Python commands; npm commands are identical. On minimal Linux, Chromium may need `npx playwright install --with-deps chromium`. POSIX execution is not verified in this phase. If PowerShell blocks npm's shim, use `npm.cmd`/`npx.cmd` without changing execution policy.

## Architecture, API and sessions

The Next route handlers are a thin **fixed-operation allowlist**. FastAPI owns normalization, validation, challenge consumption, profile selection and sessions. The browser never calls private FastAPI REST routes directly, and there is no generic proxy or browser-controlled destination.

| Browser route | Backend route | Contract |
|---|---|---|
| GET `/api/health/live` | GET `/v1/health/live` | Public deterministic liveness |
| POST `/api/auth/challenges` | POST `/v1/auth/challenges` | `username, purpose: register\|login`; returns challenge ID/expiry/purpose |
| POST `/api/auth/register` | POST `/v1/auth/register` | `challenge_id, otp, display_name, avatar_key`; creates user/session |
| POST `/api/auth/login` | POST `/v1/auth/login` | `challenge_id, otp`; session for an existing user |
| GET `/api/auth/me` | GET `/v1/auth/me` | Current profile, CSRF token, session expiry |
| POST `/api/auth/logout` | POST `/v1/auth/logout` | JSON `{}`, current session's `X-CSRF-Token`; revokes current session |
| PATCH `/api/users/me` | PATCH `/v1/users/me` | `display_name, avatar_key`, CSRF; updates only current user |
| GET `/api/users?query=...` | GET `/v1/users` | Authenticated directory; bounded query, public fields, excludes self |
| GET/POST `/api/contacts` | GET/POST `/v1/contacts` | Own contacts; POST `user_id` is directional/idempotent, requires CSRF |
| GET `/api/conversations` | GET `/v1/conversations` | Active membership only; recent order, preview/unread, query/filter/cursor |
| POST `/api/conversations/direct` | POST `/v1/conversations/direct` | `user_id`, CSRF; canonical pair, returns existing thread on retry |
| GET `/api/conversations/{id}` | GET `/v1/conversations/{id}` | Member-authorized detail, including readable seed groups |
| GET `/api/conversations/{id}/messages` | GET `/v1/conversations/{id}/messages` | `limit` 1–100; `before_id` or `after_id`; ascending returned rows |
| POST `/api/conversations/{id}/messages` | POST `/v1/conversations/{id}/messages` | Direct-only `client_message_id` UUID + nonblank `body` up to 4000 characters, CSRF |
| POST `/api/auth/ws-ticket` | POST `/v1/auth/ws-ticket` | Current session + CSRF; one-use 30-second ticket |

The initial profile is selected in onboarding. PATCH is implemented/tested as an own-profile API; no profile-edit UI was added.

Challenges expire after **5 minutes**, accept at most **5 wrong-code attempts**, and are one-use/purpose-bound. A short SQLite `BEGIN IMMEDIATE` transaction serializes verification with account/session creation. A combined **30 attempts/minute per backend client IP** limits challenge/register/login operations in one process. Proxied users share the Next gateway IP, so this is deliberately a small global demo throttle, not sophisticated abuse prevention. Restart clears the in-memory window; the challenge attempt count persists. Temporary E2E servers raise only the rate limit to avoid test contention; a backend test verifies actual 429 behavior.

Each login creates an independent **7-day** session. SQLite stores its random session ID, SHA-256 token hash, CSRF token, expiry and optional revocation time; it never stores the raw bearer token. Expiry/revocation are checked on every private request and survive app recreation. Logout revokes only the current session and closes its sockets; other browser sessions remain signed in.

Only Next receives the temporary credential-bearing backend login/register response, using a shared server-only gateway key. It returns an explicitly selected public JSON shape and stores the bearer in `scaler_session`: **HttpOnly, SameSite=Lax, Path=/, no Domain**, expiry matching the session, **Secure for HTTPS**. HTTP is accepted only for loopback development/review. The raw bearer never enters browser JavaScript, localStorage or sessionStorage; CSRF remains in component memory and can be restored through `/auth/me`.

Mutations require the configured exact **Origin**, including login/register (login-CSRF protection). Authenticated mutations also require the session-specific **X-CSRF-Token**; FastAPI checks it. Next constructs its own Authorization/internal-key headers from server configuration and cookie, ignoring browser Authorization/identity headers. Redirects are rejected; upstream timeouts are 5 seconds for auth, 8 for chat, 3 for health. JSON input is bounded to 8 KiB, or 32 KiB for message sends so 4000 Unicode characters fit; public errors are sanitized and bounded. Private responses use **Cache-Control: no-store**. Validation errors do not echo OTPs or input values. Logs contain route/status information, not credentials or bodies.

Typical errors: 400 ended challenge, 401 bad OTP/missing or expired/revoked session, 403 wrong purpose/gateway/origin/CSRF, 404 nonexistent login or absent feature route, 409 duplicate username/fixture collision, 413 oversize body, 415 non-JSON gateway mutation, 422 invalid/extra fields, 429 throttle, 503 unavailable/unconfigured service. Demo account existence is intentionally disclosed.

### Direct messages and WebSockets

FastAPI exposes `/v1/ws` directly. The browser obtains its ticket through Next, opens a credential-free socket, and sends `{v:1,type:"auth",payload:{ticket}}` as its first frame. Upgrade Origin must equal `FRONTEND_ORIGIN`; authentication must complete within 5 seconds. Tickets are session/origin-bound and consumed once. Frames are limited to 64 KiB; message text is limited to 4000 characters. Session validity is checked on commands/heartbeat and membership before send/broadcast.

Protocol events: `ready`, client `message.send`, committed `message.accepted`, participant `message.created`, `conversation.updated`, ping/pong and request-correlated `error`. A send carries `request_id`, `conversation_id`, and `payload:{client_message_id,body}`. Server identity, IDs and timestamps come from the session/database. Seed statuses are derived from stored receipts; no live read/delivered updates are fabricated.

REST and WS use the same short `BEGIN IMMEDIATE` transaction. It inserts one row per `(sender_id, client_message_id)`, captures the other direct member's receipt, increments activity/version and commits before acknowledgment/broadcast. Same-ID/same-content retries return the row; changed text/conversation conflicts. New thread creation also invalidates both members' connected lists. Every participant socket, including the sender's other tabs, receives committed events.

The client keeps a pending UUID/draft for retry, merges by server ID/UUID, and falls back to REST after a missing socket acknowledgment. Reconnect delay grows from 0.5 seconds to a 30-second cap. Ready/reconnect/tab resume fetch authorized durable list/history again. Broadcasts and tickets are in memory, so restart loses them; SQLite reconciliation restores missed state. There is no guarantee that an in-memory broadcast alone reaches a disconnected client. Run one backend worker/replica.

## SQLite schema, migration and seed

Revision **0001** is the initial Alembic migration. The application's schema strategy does not use ORM `create_all`. Eight tables (plus Alembic's revision table):

| Table | Purpose |
|---|---|
| users | Unique normalized identity and bounded display name/avatar |
| auth_challenges | One-use purpose, expiry, persisted attempt count |
| sessions | Hashed credentials and durable expiry/revocation |
| contacts | Directional unique address-book pairs; no self-contact |
| conversations | Direct/group metadata; canonical low/high direct pair UNIQUE |
| conversation_members | Composite conversation/user identity, roles and removal state |
| messages | AUTOINCREMENT ordering, stable UUID deduplication per sender, composite membership FK |
| message_receipts | Send-time recipient identities; composite message/member FKs, delivered/read state |

See [approved schema and indexes](docs/DATABASE_DESIGN.md) and [architecture](docs/ARCHITECTURE.md). SQL enforces the documented table CHECK/UNIQUE/FK relationships and UUID shape. Phase 4's transaction services enforce canonical direct creation with two members, active sender membership, UUID replay rules and direct recipient receipt creation. Group final-admin/cohort rules and live acknowledgment chronology remain Phase 5. No Phase 4 migration or developer database reset was needed.

Each SQLite connection enables foreign keys, **WAL**, and a **5-second busy timeout**. Each request/seed gets its own short-lived SQLAlchemy session. Synchronous DB routes execute in FastAPI's thread pool. Keep **one FastAPI worker**. `DATABASE_PATH` defaults to `backend/data/signal.sqlite3`; relative paths resolve against `backend/`, while absolute Windows paths or later volume paths (e.g. `/data/signal.sqlite3`) work. Parent directories are created without resetting files.

Explicit commands in `backend/`:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m alembic current
.\.venv\Scripts\python.exe -m app.seed
.\.venv\Scripts\python.exe -m app.seed
```

Fresh seed: **4 users, 6 directional contacts, 3 conversations, 7 memberships, 6 messages, 8 receipts**. Alice/Bob and Alice/Carol direct threads; “Weekend Plans” has Alice/admin, Bob and Carol/member, with **Dave outside**. History includes sent-only, delivered/unread and read states; sending is ephemeral client state, not a persisted receipt. Seed accounts have distinct original avatars.

Stable reserved user/conversation IDs **900001–900004** and deterministic message UUIDs identify fixtures. Seeding is atomic, detects unrelated reserved identities, and inserts missing records without overwriting profiles, message edits, memberships or receipt progress. Second run inserts **zero** records. It is never automatic. A collision fails without resetting existing data; inspect it rather than delete the database. Take a restorable backup before any later deployed migration.

Approved future group conventions remain full history for active members, access denial after removal, and fixed send-time receipt cohorts. No group-admin actions or messaging APIs are exposed in Phase 2.

## Phase 2 verification record (8 October 2026)

The following preserves historical Phase 2 results. Phase 3 passed **55 pytest and 16 Playwright** plus lint/typecheck/build; see [Phase 3 QA](docs/PHASE_3_VISUAL_QA.md). Current Phase 4 results are recorded in [Phase 4 handoff](docs/PHASE_4_HANDOFF.md).

From `frontend/`: `npm run lint`, `npm run typecheck`, `npm run build`, `npx playwright test` (or `npm run test:e2e`).
From `backend/`: `.venv\Scripts\python.exe -m pytest`, `.venv\Scripts\python.exe -m pip check`.

| Check | Actual outcome |
|---|---|
| ESLint | Passed, zero warnings |
| Strict TypeScript + Next route type generation | Passed |
| Next production build | Passed |
| pytest | **55 passed**, real temporary SQLite files |
| pip check | No broken requirements |
| Alembic upgrade/current/check | Revision **0001 (head)**; no new upgrade operations |
| Seed rerun | Zero inserts; automated tests preserve profile/message/member/receipt edits |
| Playwright | **10 passed**: five real-service checks at desktop 1280x800 and mobile 390x844; **2 targeted security reruns passed** after malformed-cookie/config guards |
| Manual normal-port browser | Register fictitious account, reload persisted session, logout, login as Alice; passed |
| Normal-port health | Direct 8000 and forwarded 3000 responses matched expected real JSON |
| Browser installation | Existing Chromium 156.0.8078.4, revision 1248 used successfully; no new install needed |

pytest covers actual FK/UNIQUE/CHECK enforcement, migration rerun, seed integrity/collisions, validation/OTP lifecycle, concurrent one-use consumption, persisted session hashes/app recreation/expiry/revocation, own-profile access, independent sessions, CSRF/origin and throttling. It never uses the developer DB.

Playwright starts real FastAPI **8100** and Next **3100**, with an isolated `scaler-signal-e2e-*` temporary database that its test bootstrap explicitly migrates/seeds. Readiness polling is bounded; there are no mocked responses. Tests preserve desktop/mobile health coverage and verify onboarding, cookies/storage, seeded login, forbidden requests and two independent identities. Existing test-port services are not reused: occupied ports fail to protect fixture isolation. Run one suite at a time; avoid a concurrent normal Next dev server. The test temp directory remains under OS temp for inspection, not application storage. Screenshots/traces are under OS temp `scaler-signal-playwright`, overridable through `PLAYWRIGHT_OUTPUT_DIR`.

Initial Phase 2 failures were fixed: Alembic needed `path_separator=os` under warnings-as-errors; the browser error locator needed to distinguish the app alert from Next's route announcer; screenshot capture now waits for demonstrated UI interaction before modifying input caret styles. The seed was corrected to keep Dave outside the group before handoff. The final browser run had only harmless terminal NO_COLOR/FORCE_COLOR warnings. No checks were skipped or warnings disabled.

HTTPS cookie behavior is implemented but a deployed TLS environment is not tested. Chromium/Windows are verified; Firefox/WebKit/POSIX are not. Phase 1 previously passed 4 backend/4 browser tests; their meaningful health/settings coverage remains.

## Source files

```text
README.md, .gitignore, .nvmrc, .python-version
AGENTS.md, assignment PDF, docs/              preserved requirements/design/approval
backend/
  .env.example, requirements.in, requirements.txt, pyproject.toml
  alembic.ini
  alembic/env.py, script.py.mako, versions/0001_initial_relational_schema.py
  app/__init__.py, __main__.py, main.py, settings.py
  app/database.py, models.py, auth.py, seed.py, configure_local.py
  app/routes/__init__.py, health.py, auth.py, conversations.py, socket.py
  app/realtime.py, services/direct.py
  tests/conftest.py, test_health.py, test_settings.py
  tests/test_database.py, test_auth.py, test_seed_collisions.py, test_direct_phase4.py, e2e_server.py
frontend/
  AGENTS.md, .env.example, package.json, package-lock.json
  tsconfig.json, next-env.d.ts, eslint.config.mjs, playwright.config.ts
  app/layout.tsx, page.tsx, globals.css, onboarding.tsx
  app/messenger/{types,fixtures,icons,primitives,sidebar,chat-pane,dialogs,messenger,use-chat-data}
  next.config.ts
  app/api/health/live/route.ts
  app/api/auth/{challenges,register,login,me,logout,ws-ticket}/route.ts
  app/api/users/route.ts, users/me/route.ts, contacts/route.ts
  app/api/conversations/route.ts, direct/route.ts, [id]/route.ts, [id]/messages/route.ts
  lib/backend.ts, auth-gateway.ts, chat-gateway.ts
  public/avatars/{sky,fern,sun,clay}.svg
  tests/scaffold.spec.ts, auth.spec.ts, messenger.spec.ts
```

Local `.env`, SQLite files, venvs, dependencies, builds, caches and test captures are ignored. There is no Git repository initialized, commit, push, deployment or paid resource.

## Next gate

Phase 3 Windows/light and documented reference approximations were [approved](docs/PHASE_3_APPROVAL.md). Phase 4 validation passed on 9 October 2026 and awaits user acceptance. The next proposed phase is group management/sending, typing and real delivery/read acknowledgment behavior. Do not begin it without explicit instruction.

Groups/typing/receipts are Phase 5; integration/visual QA Phase 6; final README/deployment/E2E Phase 7. Railway's paid plan is available, but provisioning, public-repository creation/push and deployment still need approval. No optional features before mandatory features pass.

Railway preflight: [deployment plan](docs/RAILWAY_DEPLOY_PLAN.md). Use service roots `/frontend` and `/backend`, frontend `npm run start:production`, backend `python -m app.startup`. Both bind `0.0.0.0` using `PORT`. Backend startup requires an explicit absolute `DATABASE_PATH`, existing storage directory, frontend Origin and gateway key; on Railway it requires the `/data` volume and `/data/signal.sqlite3`, then runs Alembic before starting one worker. Migration failure prevents server startup. Seeding remains an explicit action and never runs at startup. Keep one backend replica.

Both services require the same private gateway key and exact HTTPS frontend Origin. Set frontend build-time `NEXT_PUBLIC_WS_URL=wss://<BACKEND_DOMAIN>/v1/ws` and server-only `BACKEND_BASE_URL=https://<BACKEND_DOMAIN>`. A rebuild is required after changing the public WS URL. Local production-mode migration, two-user messaging and restart persistence passed against a throwaway DB; actual Railway provisioning, TLS/WSS and volume persistence across redeploy await separate approval. No developer DB will be uploaded.
