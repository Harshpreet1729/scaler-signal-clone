# Scaler Signal assignment

**Phase 5 adds group creation/admin membership and messaging, durable delivered/read acknowledgments, unread state, typing and incoming toasts** to the authenticated Signal-inspired app. Local validation: 78 backend tests, 32 desktop/mobile browser tests, lint, TypeScript and production build pass. See [Phase 5 handoff and actual validation](docs/PHASE_5_HANDOFF.md).

Access the [public demo](https://frontend-production-5f84.up.railway.app/), [public repository](https://github.com/Harshpreet1729/scaler-signal-clone) and [backend health](https://backend-production-5383.up.railway.app/v1/health/live). The owner authorized the Phase 5 production rollout on 9 October; GitHub pushes deploy both existing services. The earlier [Phase 4 production verification](docs/RAILWAY_DEPLOYMENT.md) is historical evidence, not a Phase 5 test report.

**Deadline: 9 October 2026, 6:00 PM IST (12:30 UTC).** This is an original interview assignment, not an official Signal client. **Demo OTP `123456` is public and impersonable. Use fictitious data only. There is no real end-to-end encryption.**

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

Use separate browser profiles or an incognito window for Alice and Bob. Alice opens Bob's existing chat; Bob opens Alice's. Enter sends, Shift+Enter inserts a newline. Both see the live exchange; refresh and select the thread again to verify saved history. New Chat searches the public demo directory and opens an existing or new direct thread; New Contact adds a directional contact. A fresh account starts with no chats. Messages become **sent** after commit, **delivered** after recipient acknowledgment, and **read** after incoming messages are visible in the selected chat. Unread clears only after the read acknowledgment is stored.

Local browser WebSockets connect directly to `ws://127.0.0.1:8000/v1/ws`. `frontend/.env.example` documents `NEXT_PUBLIC_WS_URL`; configure it before a build for a different backend. No credential is placed in this URL.

Use **127.0.0.1 consistently**; do not mix it with localhost. Frontend [health forwarding](http://127.0.0.1:3000/api/health/live) obtains the real [FastAPI health response](http://127.0.0.1:8000/v1/health/live):
`{"status":"ok","service":"scaler-signal-api"}`.
[FastAPI API docs](http://127.0.0.1:8000/docs) describe backend contracts, but credential-bearing auth routes require the server-only gateway key. Use the app for login rather than exposing that key to a browser tool.

Stop servers with Ctrl+C. To review a production build locally, use `npm run build` then `npm run start`. Do not run Next dev and production servers against the same `.next` directory simultaneously. Browser tests use Next dev and can replace build artifacts; rebuild afterward before `npm run start`.

Portable POSIX setup substitutes `python3.13 -m venv .venv` and `.venv/bin/python` for the Windows Python commands; npm commands are identical. On minimal Linux, Chromium may need `npx playwright install --with-deps chromium`. POSIX execution is not verified in this phase. If PowerShell blocks npm's shim, use `npm.cmd`/`npx.cmd` without changing execution policy.

## Groups, receipts and typing

Use New Chat → New group, enter a name and select members. The creator is admin. Group details exposes rename, directory-based add, and removal to admins; every operation is also authorized on the server. Groups allow at most 100 active members and cannot lose their final admin. Direct membership cannot change.

New members can see all earlier history, but receive no retroactive receipt rows. Removed members lose server access and live events; historical membership/receipt rows remain. Rejoining restores history and their original receipts. Content already received before removal cannot be recalled. Group delivered/read ticks require **all original send-time recipients** to acknowledge; a removed recipient can keep an old message partially acknowledged.

Sending is temporary client state; sent means SQLite committed. A delivered acknowledgment confirms receipt by a recipient client. Reading requires incoming message elements intersecting the visible selected history while the document is visible. Merely fetching history, opening another conversation, or receiving a socket frame cannot mark it read. Unread derives from persisted receipt rows. Settings preference controls remain explicitly disabled placeholders; acknowledgments and typing are enabled for the demo.

Typing is per socket, aggregated per user, throttled to about two seconds and expires after five seconds (server sweep every half-second). Clear/send/blur/chat switch/logout/disconnect stops it. It never writes SQLite or reorders chats. A new incoming message outside the selected chat produces a deduplicated in-app toast; own sends and REST history do not.

## Architecture and API

Next.js App Router + TypeScript owns the UI and fixed-operation REST forwarding. FastAPI owns authentication, validation, authorization and transactions. SQLite with Alembic stores durable state. Native browser WebSockets connect directly to FastAPI. No Redis, ORM client, global state manager, or new dependency was added for Phase 5.

Browser `/api` routes map to fixed backend `/v1` routes. The gateway accepts no arbitrary upstream path or browser identity. Private responses use `no-store`; mutations require exact frontend Origin plus session CSRF. Errors return `error.code` and `error.message`; inaccessible resources return 404, admin denial 403, invalid fields 422, conflicts 409.

| Method / path (below either prefix) | Purpose / request |
|---|---|
| GET `/health/live` | Public liveness; deterministic non-sensitive response |
| POST `/auth/challenges` | `username`, `purpose` register/login |
| POST `/auth/register` | `challenge_id`, demo `otp`, `display_name`, `avatar_key` |
| POST `/auth/login`; GET `/auth/me`; POST `/auth/logout` | Persisted session lifecycle; logout JSON `{}` |
| PATCH `/users/me` | Own display name/preset avatar API; profile editing UI deferred |
| GET `/users?query=...` | Bounded authenticated public demo directory |
| GET/POST `/contacts` | Own directional contacts; POST `user_id` |
| GET `/conversations?query&filter&cursor` | Active memberships, recent order, previews/unread; `all`/`unread` |
| POST `/conversations/direct` | `user_id`; idempotent canonical user pair |
| POST `/conversations/groups` | `name`, `user_ids`; creator becomes admin |
| GET/PATCH `/conversations/{id}` | Member detail / admin group rename with `name` |
| GET/POST `/conversations/{id}/members` | Member list / admin add with `user_ids` |
| DELETE `/conversations/{id}/members/{user_id}` | Admin removal; Next request sends JSON `{}` |
| GET `/conversations/{id}/messages` | History: `limit` 1–100, mutually exclusive `before_id`/`after_id` |
| POST `/conversations/{id}/messages` | Direct/group text: stable `client_message_id` UUID, nonblank `body` ≤4000 characters |
| POST `/conversations/{id}/delivered`, `/read` | `message_ids`, 1–100; authenticated user's eligible original receipts only |
| POST `/auth/ws-ticket` | Session/CSRF-protected one-use ticket, 30 seconds |

Username onboarding uses a five-minute, single-use challenge with at most five incorrect OTP attempts. Server rate limiting is process-local and shared behind the gateway; it is deliberately simple demo protection. Opaque session tokens are hashed in SQLite. The gateway stores the raw token only in a host-only HttpOnly, SameSite=Lax cookie, Secure on HTTPS, with seven-day expiry. Browser storage and URLs contain no long-lived session credential. Logout revokes that session and its sockets; independent sessions remain signed in.

WS `/v1/ws` requires exact Origin and first-frame `{v:1,type:"auth",payload:{ticket}}` within five seconds. Version-1 events: `ready`, `message.send`, `message.accepted`, `message.created`, `conversation.updated`, `membership.removed`, `receipt.updated`, `typing.set`, `typing.changed`, `ping`/`pong`, and correlated `error`. `message.send` carries `conversation_id` plus payload `client_message_id, body`; `typing.set` carries the conversation and payload `{typing:boolean}`. Sender identity and timestamps come from the server. Receipt commands use REST; receipt changes arrive over WS. Public messages include original `recipient_ids`, `delivered_ids`, `read_ids` and aggregate `status`.

REST and WS use the same send transaction. SQLite `BEGIN IMMEDIATE` serializes membership/send/ack writes. A single-process mutation lock covers commit plus publication, with fresh authorization for each recipient and bounded socket writes. Authentication reads release their connection before waiting for this lock; socket database checks run in a threadpool. This avoids holding all pool connections during concurrent acknowledgment bursts. **One backend worker and one replica are required.**

The client merges by server ID/client UUID, retains monotonic receipt progress, and retries a failed send with the same UUID. Reconnect, foreground return and a 30-second visible-page repair refresh lists and selected loaded history, paging through missed messages/older receipts. Pending drafts survive retries in memory, not a full browser restart. Socket events are not a durable event log; REST repairs missed publication.

## Database and seed

The unchanged Alembic revision is **0001**; Phase 5 needs no schema migration. Eight tables:

| Table | Purpose / key constraints |
|---|---|
| `users` | Unique normalized username and original preset avatar |
| `auth_challenges` | OTP challenge expiry, attempts, consumption |
| `sessions` | Hashed opaque token, CSRF, expiry, revocation |
| `contacts` | Directional owner/contact composite key, no self-contact |
| `conversations` | Direct canonical low/high unique pair or named group; activity/version |
| `conversation_members` | Conversation/user composite key, role, join/removal time |
| `messages` | Member sender FK, unique sender/client UUID, stable autoincrement history ID |
| `message_receipts` | Message/recipient composite key and matching conversation FKs; read implies delivered |

Foreign keys, WAL, and a five-second busy timeout apply on every connection. Membership/activity/history/unread indexes support access patterns. See [schema rationale](docs/DATABASE_DESIGN.md); actual models are `backend/app/models.py`.

Explicit `python -m app.seed` adds fictitious Alice/Bob/Carol/Dave accounts, six contacts, three conversations, seven memberships, six messages and eight illustrative receipt rows to a fresh migrated database. Seed IDs/UUIDs are stable; rerunning inserts nothing and preserves edits, membership changes and acknowledgments. Collisions fail instead of resetting data. Dave starts outside Weekend Plans; Alice is its admin. Never reset or automatically reseed the hosted database.

## Tests and local evidence

```powershell
# frontend/
npm run lint
npm run typecheck
npm run build
npx playwright test

# backend/
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m pip check
```

Playwright starts real Next **3100** and FastAPI **8100**, explicitly migrates/seeds a new temporary SQLite file, and uses separate browser contexts. It refuses occupied test ports. Output defaults to OS temp `scaler-signal-playwright`; `PLAYWRIGHT_OUTPUT_DIR` can override it. Chromium/Windows are tested; Linux, Firefox and WebKit are not locally verified. No developer or production database is used. Backend tests exercise actual SQLite transactions, concurrent writes, authorization and WS events. Actual counts, intermediate failures and screenshots are recorded in [Phase 5 handoff](docs/PHASE_5_HANDOFF.md). The earlier [Phase 3 visual reference/QA](docs/PHASE_3_VISUAL_QA.md) remains the approved baseline.

## Deployment gate and limitations

Phase 5 commit/push and rollout to the existing Railway services are authorized. Preserve the existing SQLite volume and all production variables. The [Railway plan](docs/RAILWAY_DEPLOY_PLAN.md) and [current service configuration](docs/RAILWAY_DEPLOYMENT.md) remain applicable: roots `/frontend` and `/backend`, frontend `npm run start:production`, backend `python -m app.startup`, Railway `PORT`, one worker/replica, `/data/signal.sqlite3`. Startup validates the mounted volume and runs Alembic **after mount**, before serving; migration failure stops startup. Do not seed on startup.

`BACKEND_BASE_URL` and the matching gateway key stay server-only. `NEXT_PUBLIC_WS_URL` is a credential-free WSS endpoint embedded during build. Exact HTTPS `FRONTEND_ORIGIN` must match both services. Budget remains $10/month with the existing hard limit unchanged; this rollout provisions no resources and changes no billing settings. Public verification must confirm the new release before declaring deployment complete.

Calls, stories, linked devices and privacy/notification/appearance preferences remain labeled placeholders. Presence is mocked. Attachments, reactions, quoted replies, dark mode and disappearing messages are deferred. No real encryption is claimed. Phase 6 integration/pixel QA and Phase 7 final submission remain separately gated; do not submit automatically.
