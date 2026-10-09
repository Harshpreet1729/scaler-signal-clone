# Architecture proposal

> **HISTORICAL — original Phase 0 proposal.** Implementation and deployment are complete. The proposal below preserves the original design and hosting evaluation; its approval requests and future tense describe that planning stage. See the [current README](../README.md#system-architecture) and [final verification](FINAL_VERIFICATION.md).

## Shipped architecture: current clarification

- Next.js + TypeScript UI and allowlisted authenticated REST gateway; FastAPI + authenticated WebSockets; SQLite + SQLAlchemy + Alembic on Railway's persistent `/data` volume. Both services are on Railway; the original Vercel/Render recommendation below was superseded.
- Opaque cookie sessions, one-use first-frame socket tickets, mock OTP, active membership checks and one backend worker/replica are implemented. Groups, receipts, typing, reactions, editable profiles and unified sidebar search are shipped.
- Delivery/read acknowledgments use REST; `receipt.updated` arrives over WebSocket. Removal uses `membership.removed`. Proposed client `receipt.delivered`/`receipt.read` socket commands and `/health/ready` are not implemented; liveness is `/health/live`.
- The implementation uses one process-wide mutation lock and timed socket sends, rather than the proposed per-conversation queues. Reconnect uses capped exponential backoff without jitter, with REST reconciliation. These are demo-scale choices, not horizontal scalability claims.
- Reactions use `POST /conversations/{id}/reactions`, `reaction.updated`, and additive migration `0002`. See [current contracts](../README.md#database-and-api) and [reaction migration/rollback](REACTIONS_MIGRATION_PLAN.md). No real E2EE is implemented.

## Original proposal (historical)

Original status at Phase 0: awaiting approval; no application code or services existed then. Decisions below were proposals unless a source was cited.

## Components and ownership

- `frontend/`: Next.js App Router + TypeScript, original components and CSS tokens, native fetch/WebSocket, React state/reducer for session and normalized chat state. Avoid a global state library initially.
- Next.js contains a small, allowlisted REST forwarding layer at `/api/*`: transport, cookie handling, and CSRF checks only. Business rules remain in FastAPI. This keeps the browser session cookie first-party even when the two services use unrelated hosting domains.
- `backend/`: FastAPI routers, Pydantic request/event models, shared authorization dependencies, small services for multi-row transactions, SQLAlchemy models/queries, Alembic migrations, pytest tests. No generic repository abstraction.
- SQLite on a durable local volume. One FastAPI instance with **one Uvicorn worker**; an in-memory registry maps each authenticated user/session to every open socket. No Redis or message broker for this assignment.
- Browser REST -> Next.js -> FastAPI -> SQLite. Browser WSS -> FastAPI directly. Next.js never hosts or relays the persistent socket.

FastAPI supports WebSockets and dependency-based validation; its example in-memory connection manager is process-local, which motivates the single-worker limit. [FastAPI documentation](https://fastapi.tiangolo.com/advanced/websockets/)

## Mock authentication with real session enforcement

Propose lowercase ASCII usernames (3-32 characters), display names (1-80), and selectable original preset avatars. Normalize before uniqueness checks. Username registration satisfies the PDF's either/or option. Show a demo-only OTP on onboarding; its configurable fixed value is test data, not a production secret. No real phone verification or passwords.

1. Request a short-lived challenge for `register` or `login`; verify the configured demo OTP. Challenges expire in five minutes, have five attempts, and are single-use. Apply rate limits to challenge creation and verification. Explicitly label this impersonable test login; use fictitious data only.
2. Verification atomically consumes the challenge, creates a user when registering, and creates a random opaque session. Store only the token hash in SQLite. Reject duplicate usernames; login never silently creates users.
3. The Next.js forwarding layer sets a host-only `HttpOnly`, `Secure`, `SameSite=Lax`, path `/` cookie with seven-day expiry. Local HTTP development is the sole Secure-flag exception. Never expose the long-lived token in client JSON or browser storage. Private responses are `Cache-Control: no-store` at both layers.
4. Next.js forwards the cookie token to FastAPI as a server-to-server bearer credential. It strips browser-supplied identity/authorization headers and only forwards known API paths/methods to a fixed backend URL. Validate exact frontend Origin and a session-bound CSRF token on cookie-authenticated mutations; protect login/register with Origin validation and JSON-only requests too.
5. Fresh reload calls `/api/auth/me`; expired/revoked sessions return 401 and clear local user data. Logout revokes the DB session, deletes the cookie, and closes all sockets for that session. Other independently logged-in sessions stay active.

For WSS, authenticated `POST /auth/ws-ticket` returns a random one-use ticket, valid for 30 seconds and bound to the session and allowed frontend Origin. Keep tickets in backend memory. Browser sends it in the **first socket frame**, never a URL. Reject missing/disallowed Origin during upgrade; close an unauthenticated connection after five seconds, sending no application data. Atomically consume the ticket, revalidate the DB session, then register the socket. Check expiry/revocation on every command and before outgoing data; heartbeat also enforces expiry. Backend restart invalidates tickets, so the client requests a new one.

## REST contract

Backend prefix `/v1`; browser uses equivalent `/api` routes. JSON errors contain stable `code`, safe `message`, optional field errors, and request ID. Unauthenticated = 401; inaccessible conversation/message = 404; known member without admin rights = 403; conflicts = 409; invalid inputs = 422; throttling = 429. No ownership is accepted from client identity fields.

| Method/path (below prefix) | Purpose and authorization |
|---|---|
| POST `/auth/challenges` | Start register/login challenge; public, rate-limited. |
| POST `/auth/register`, `/auth/login` | Verify challenge; register includes display name/avatar; return session internally to forwarding layer. |
| GET `/auth/me`; POST `/auth/logout` | Current session/profile/CSRF token; revoke current session. |
| POST `/auth/ws-ticket` | One-use ticket for current authenticated session. |
| PATCH `/users/me` | Update own display name/preset avatar. |
| GET `/users?query=...` | Authenticated, bounded directory lookup by username/display name; public demo profile fields only. |
| GET/POST `/contacts` | Search/list own contacts; add existing user idempotently. Reject self-contact. |
| GET `/conversations?query=...&filter=all|unread&cursor=...` | Only active memberships; recent activity, preview, unread count, mocked presence. Search titles/contact names, not message bodies. |
| POST `/conversations/direct` | Target user ID; atomically get/create canonical pair and two members. Contact is not an authorization prerequisite. |
| GET `/conversations/{id}` | Active member only; metadata and current state version. |
| GET `/conversations/{id}/messages?before_id=...&after_id=...&limit=...` | Active member only; keyset pagination, mutually exclusive before/after, default 50/max 100, includes receipt state. |
| POST `/conversations/{id}/messages` | Active member; text plus client message UUID. REST retry/fallback to same service used by WS. |
| POST `/conversations/{id}/delivered` | Active member; bounded received message IDs; only own eligible receipt rows. |
| POST `/conversations/{id}/read` | Active member; bounded visible message IDs; own receipts only, read implies delivered. |
| POST `/conversations/groups` | Authenticated creator; nonempty name, unique existing member IDs; creator becomes admin atomically. |
| GET `/conversations/{id}/members` | Active member only. |
| PATCH `/conversations/{id}` | Group name change by active admin. |
| POST `/conversations/{id}/members`; DELETE `/conversations/{id}/members/{user_id}` | Active group admin only; prohibit direct membership edits and removing final active admin. |
| GET `/health/live`, `/health/ready` | No personal data; readiness checks DB/migration availability. |

Proposed limits: 4,000-character text, 100 members/group, 100 IDs/ack, 64 KiB socket frame. These are assignment assumptions, not Signal limits. Render text as text, never raw HTML. No uploads in mandatory scope.

## WebSocket protocol and status semantics

Versioned JSON envelope: `v`, `type`, `request_id`, optional `conversation_id`, `payload`. Server supplies identity, message IDs, UTC timestamps, and state versions. Errors correlate with request IDs. Authenticate once, authorize every command and every outgoing conversation payload; no client-controlled room subscription grants access.

| Direction | Event | Meaning |
|---|---|---|
| Client -> server | `auth` | Consume ticket before any other command. |
| Server -> client | `ready` | Authentication succeeded; begin REST reconciliation. |
| Client -> server | `message.send` | Conversation ID, client UUID, text. |
| Server -> client | `message.accepted` | Request mapping to committed message ID/time; only after commit. |
| Server -> client | `message.created` | Committed message to all currently authorized member sockets, including sender's other tabs. |
| Client -> server | `receipt.delivered`, `receipt.read` | Bounded message IDs actually received/rendered by this user. |
| Server -> client | `receipt.updated` | Own read state to user's sessions; per-recipient status to message author's sessions. |
| Client/server | `typing.set` / `typing.changed` | Boolean typing, server-derived user ID, expiry. |
| Server -> client | `conversation.updated`, `membership.changed` | Invalidate/refetch authorized metadata; removed user gets only a revocation notice without chat content. |
| Client/server | `ping` / `pong`, `error`, `session.revoked` | Liveness, correlated errors, auth closure. |

Sending exists only in the client's pending state. Sent means SQLite committed. Delivered means at least one recipient session acknowledged receipt; a successful socket write alone is insufficient. Read means recipient explicitly acknowledged rendered incoming messages while the correct chat is selected and the document visible/focused. Never mark read merely by fetching history. A read ack fills missing delivery time in the same transaction. Updates are idempotent and never regress.

For groups, create one receipt per non-sender member at send time. Display delivered/read only when **all** those recipients reach the state, with counts in details. New members do not become recipients of old messages; removal does not fabricate old acknowledgments. An old group message may consequently remain partially delivered. This group aggregation is a proposed convention, not a PDF-defined rule.

Typing sends on first input, refreshes at most every two seconds, expires after five seconds, and stops on send, blur, empty input, chat switch, logout, or disconnect. Track per connection and aggregate per user, so one tab stopping does not erase another tab's active typing. Typing never writes SQLite or changes unread/activity order. Mocked online/last-seen labels are visibly identified as demo status.

## Reconnect, ordering, and concurrency

- One socket per tab. Heartbeat every 20 seconds; reconnect after liveness failure, with exponential backoff from 0.5 to 30 seconds plus jitter. Resume promptly on browser online/focus. Stop retries after auth rejection until login.
- Connect/authenticate and buffer incoming events **before** fetching current conversation/member/unread snapshots and message pages. Merge by server message ID/client UUID and highest state version; then apply buffered events. Catch up missed IDs in pages, and refresh receipt state for previously loaded outgoing messages (older receipts may change without new messages).
- Repeat reconciliation on reconnect, foreground return, and every 30 seconds while visible. The periodic repair handles the rare commit-before-broadcast failure without a persistent event log. Normal delivery remains WebSocket-driven. A bounded server queue closes slow clients and forces resync rather than growing memory indefinitely.
- Keep pending UUIDs stable across socket retries and REST fallback. A lost acknowledgment must not create two messages. A reused UUID with different text/conversation returns conflict. Pending drafts are in-memory; offline reload persistence of unsent text is deferred.
- Database is the source of truth. Message IDs establish order; server timestamps are display data. Server mutations increment a conversation version, update latest activity, insert receipts, and commit atomically. Client receipt merges retain maximum progress/times to survive out-of-order packets.
- Use short write transactions, `foreign_keys=ON`, WAL, and a bounded busy timeout (proposed five seconds). SQLite still has one writer; WAL permits readers alongside a writer. Keep the DB and WAL files on the same local mounted volume, not a network-shared file. [SQLite WAL documentation](https://www.sqlite.org/wal.html)
- Serialize conversation mutations and event queue insertion per conversation in the single backend process. Membership check and write happen in the same transaction, so concurrent removal/send is ordered. Recheck recipients before enqueue/send; purge queued conversation payloads on removal. Content already received before removal cannot be recalled.
- Use SQLAlchemy sessions scoped to one request/operation, never shared between sockets. Run synchronous database work off the event loop; never hold transactions while awaiting network output. On lock timeout return retryable error; client retries with the same UUID.

## Seed and testing

Four fictitious accounts: `alice`, `bob`, `carol`, `dave`, each using the documented demo OTP and a distinct preset avatar. Alice/Bob have direct history; Alice/Carol a second thread for ordering; “Weekend Plans” contains Alice (admin), Bob and Carol, with Dave outside it. Include incoming unread, sent-only, delivered, and read messages with coherent timestamps.

Explicit seed command runs after migrations, uses stable identities/message UUIDs, and never runs on every startup. Repeating it must not duplicate records, reset receipts, or overwrite user changes. Destructive reset is local/test-only and separately invoked. pytest covers constraints/authorization/transactions; Playwright uses isolated browser contexts against real backend + a temporary SQLite file. See [E01-E12](ACCEPTANCE_TESTS.md).

## Deployment feasibility (checked 2026-10-08; no deployment)

| Strategy | Feasibility and constraints |
|---|---|
| **Recommended: Vercel frontend + paid Render FastAPI with persistent disk** | Next.js cookie/REST layer on Vercel; browser WSS goes directly to Render. Render explicitly supports FastAPI and WebSockets. Mount `/data`; DB at `/data/signal.sqlite3`. One backend worker/instance. Disk-backed deployment may cause downtime, handled by reconnect. Free frontend depends on Hobby eligibility/usage limits. |
| Railway frontend/backend or Vercel + Railway backend | Durable attached volume is supported; volumes prevent replicas and introduce brief redeploy downtime. Hobby has a USD 5 minimum including USD 5 usage, with excess billed separately. Trial/free credits are useful for a short demo but do not establish a reliable zero-cost ongoing service. Verify account eligibility and traffic budget before selection. |
| Render free backend | Unsuitable for authoritative SQLite: filesystem changes are lost on restart/redeploy/spindown and free web services cannot attach disks. |
| Existing durable VM | Two Node/Python processes behind a TLS reverse proxy are feasible with local disk and backups. No incremental hosting cost only if a suitable VM already exists; none is confirmed. More operational work than managed services. |
| Codex Sites | Python process, WSS, mounted filesystem durability, backups, and worker controls are unverified. Not selected; no claim of support. |

Primary evidence: [Render FastAPI/web services](https://render.com/docs/web-services), [WSS](https://render.com/docs/websocket), [persistent disks](https://render.com/docs/disks), [free limitations](https://render.com/docs/free), [pricing](https://render.com/pricing); [Railway pricing](https://railway.com/pricing) and [volume limits](https://docs.railway.com/volumes/reference); [Vercel Hobby](https://vercel.com/docs/plans/hobby) and [function limitations](https://vercel.com/docs/limits). Vercel Functions cannot act as a WebSocket server. Hobby is for personal non-commercial use, so confirm eligibility. Render's exact compute-plus-disk price was not reliably exposed in the fetched pricing page; obtain a dashboard quote before approval. No guaranteed ongoing zero-cost durable deployment was established.

Release operations: backup SQLite through its backup API (not an uncoordinated copy of a live DB); retain an off-volume copy; test restore. Mount volume before migrating; run migrations once before serving; never seed destructively on deploy. Verify records survive a backend restart **and** redeploy. Pin runtime/dependency versions in Phase 1, configure allowed origins/backend URL/DB path/demo auth settings through environment, keep `.env` ignored, log no cookies/OTP/tickets/message bodies. Confirm both public URLs work without a hosting login and remain available through evaluation. Select region, budget, retention, and deadline before Phase 7.

Approval requested: username + preset-avatar scope; first-party cookie forwarding + socket tickets; single backend worker; explicit demo auth; full-history group access for new members (see schema); receipt aggregation; chosen hosting budget/provider. None of these approvals authorizes deployment.
