# Railway early deployment preflight

Status: deployment authorized and executed, 9 October 2026. Submission deadline: **9 October 2026, 18:00 IST**. The final owner decision uses Railway for both services and a **$10/month workspace ceiling**, keeping the existing hard limit unchanged. See [actual URLs, applied settings and verification](RAILWAY_DEPLOYMENT.md). The sections below preserve the original preflight recipe and local evidence; historical statements about no external changes/unassigned URLs describe that preflight, not current state.

Live-build correction: omit `RAILPACK_INSTALL_CMD`. With `packageManager: npm@11.6.2`, Railpack 0.40.1's custom install override skipped Corepack preparation and failed exporting `/opt/corepack`. The successful build used Railpack's default Corepack setup and `npm install` with the committed lockfile. Local installation remains `npm ci`. No application dependencies or runtime pins changed.

This can host the current Phase 4 demo; it does **not** complete the assignment. Group writes/sending, typing and live delivered/read acknowledgments remain Phase 5 work. Existing mock-OTP/no-E2EE notices must remain visible. Only fictitious profiles, original avatars and explicit sample fixtures belong in the public demo.

## Service contracts

| Setting | frontend | backend |
|---|---|---|
| Source root | `/frontend` | `/backend` |
| Builder | Railpack | Railpack |
| Install | Railpack default Corepack setup and lockfile-based `npm install` | Railpack pip install from pinned `requirements.txt` |
| Build command | `npm run build` | Default; **no database action** |
| Pre-deploy command | Empty | **Empty: volume unavailable here** |
| Start command | `npm run start:production` | `python -m app.startup` |
| Bind | `0.0.0.0`, process `PORT` | `0.0.0.0`, process `PORT`, one Uvicorn worker |
| Healthcheck | `/api/health/live` (checks real backend) | `/v1/health/live` |
| Storage | Ephemeral build/runtime files | Fresh persistent volume mounted `/data` |
| Replicas/region | One; same region as backend | **One, single region** |

Service roots isolate source trees. Configure empty services before connecting the repository. No Windows paths appear in deployment commands. [Railway monorepo guide](https://docs.railway.com/guides/deploying-a-monorepo).

The portable Python entry point checks required environment/storage, upgrades Alembic to `head`, then starts the API. Exceptions stop startup. It never seeds or resets data. It also checks Railway's runtime volume marker when `RAILWAY_ENVIRONMENT_ID` is present; do not manually fabricate that marker. The dashboard mount configuration remains an operational prerequisite. Volumes are unavailable during build and pre-deploy. [Railway volumes](https://docs.railway.com/volumes).

## Variables: set in Railway, never in Git

Replace `<FRONTEND_DOMAIN>` and `<BACKEND_DOMAIN>` with the actual generated hostnames, without scheme, slash or path. These are placeholders, not provisioned URLs. Prefer literal final URLs for this deadline so the exact allowlist is easy to audit.

| Key | frontend value | backend value | Timing / secrecy |
|---|---|---|---|
| `PORT` | `8080` | `8080` | Explicit service port; domain target also 8080; both commands read env |
| `FRONTEND_ORIGIN` | `https://<FRONTEND_DOMAIN>` | Same exact value | Runtime; no trailing slash |
| `BACKEND_BASE_URL` | `https://<BACKEND_DOMAIN>` | Unset | Server-only, fixed REST/auth origin |
| `NEXT_PUBLIC_WS_URL` | `wss://<BACKEND_DOMAIN>/v1/ws` | Unset | **Before frontend build**; public URL, no credentials/query |
| `INTERNAL_API_KEY` | Same private random key | Same private random key | Secret, at least 32 characters; owner generates and stores in Variables |
| `DATABASE_PATH` | Unset | `/data/signal.sqlite3` | Runtime; actual supported key, **not** `DB`/`DATABASE_URL` |
| `HOST` | Unset | `0.0.0.0` | Safe explicit configuration; production entry point always binds all interfaces |
| `SESSION_SECONDS` | Unset | `604800` | Optional existing default |
| `CHALLENGE_SECONDS` | Unset | `300` | Optional existing default |
| `AUTH_RATE_LIMIT` | Unset | `30` | Combined auth attempts per observed gateway IP per minute |
| `RAILPACK_NODE_VERSION` | `24.13.0` | Unset | Build runtime pin |
| `RAILPACK_PYTHON_VERSION` | Unset | `3.13.12` | Build runtime pin |
| `RAILPACK_INSTALL_CMD` | **Unset** | Unset | Use Railpack's default Corepack/install flow; see live-build correction |
| `NEXT_TELEMETRY_DISABLED` | `1` | Unset | Optional |
| `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` | `10` | `10` | Graceful shutdown allowance |
| `RAILWAY_VOLUME_MOUNT_PATH` | Unset | Railway-provided `/data` | **Do not set yourself**; attaching volume provides it |

Runtime pins use Railpack's supported override keys; existing npm lockfile and fully pinned Python requirements remain unchanged. Linux image dependency resolution is still a live-build check. [Railpack Node](https://railpack.com/languages/node/), [Python](https://railpack.com/languages/python), [install override](https://railpack.com/config/environment-variables), [Railway variables](https://docs.railway.com/variables/reference).

`NEXT_PUBLIC_WS_URL` is directly referenced in client code and embedded by Next build. Keep **Skipped Builds disabled**; changing the WS hostname requires a full rebuild, not just a restart. Runtime server-only values remain outside the browser bundle. [Railway build caching](https://docs.railway.com/builds/skipped-builds).

## Deployment recipe — execute only after separate approval

1. Review source and ignore rules before publishing the original public repository. Exclude `.env`, `.venv`, node_modules, build/test artifacts, and **all SQLite/WAL/shm files**. Never upload the local developer DB, Playwright accounts or test-message UUIDs. No clone/template code is needed. Obtain repository creation/push permission first.
2. Railway dashboard → **New Project → Empty project** in the owner's existing paid workspace. Name it; create two **Empty Services**, named `frontend` and `backend`. Review/apply the empty-service changes. This intentionally avoids an immediate source deployment.
3. Each service → Settings → Source → Root Directory: `/frontend` or `/backend`. Select Railpack; set the build/start commands from the table. Leave both pre-deploy commands empty. Select the same suitable region (confirm availability before attaching storage). Keep one replica and Serverless/app sleep disabled for predictable demo/socket availability. Use On Failure restart with a bounded retry count (e.g. three).
4. Attach a **new** volume to `backend` via the canvas Add Volume action; mount `/data`. Do not attach/import a local database. Confirm its service, environment and mount before proceeding. Start with the smallest suitable plan-supported capacity; no extra storage services are needed.
5. Set `PORT=8080` on both services. Settings → Networking → Generate Domain for each, target port **8080**. Record actual domains in the placeholders above. Explicit port selection permits configuring domains before source deployment; if the UI requires a deployment first, pause and adapt the staged setup rather than launching with guessed Origin/WS values. Railway documents custom PORT/domain targets. [Monorepo domain setup](https://docs.railway.com/guides/deploying-a-monorepo).
6. Variables → enter the table values with final domains. Generate a new random gateway key locally, paste the same value into both services, never into source/screenshots/logs. Confirm the volume-provided mount variable exists at runtime. Set backend healthcheck `/v1/health/live`, frontend `/api/health/live`, timeout 300 seconds. Healthchecks gate deployment but do not continuously monitor uptime. [Healthchecks](https://docs.railway.com/deployments/healthchecks).
7. After repository approval/publication, connect the chosen repository/branch to **backend**, review staged changes, deploy backend first. Logs must show successful startup after migration; missing mount or failed migration must keep it offline. Check `https://<BACKEND_DOMAIN>/v1/health/live` returns `{"status":"ok","service":"scaler-signal-api"}`.
8. Perform the explicit first-time seed below. Connect/deploy **frontend** only after its final build-time WS URL and server-only variables are set. Confirm the build log uses pinned Node and `npm ci`; start log binds the configured port. Check frontend `/api/health/live` matches backend response.
9. Run the HTTPS/WSS and persistence checks below before handing out the demo URL. Preserve source/version identifiers, variables without secrets, migration revision and test observations in the release record. Do not call the assignment complete while Phase 5 requirements are missing.

One volume cannot be shared by active deployments/replicas; Railway serializes volume-backed redeploys with brief downtime. Keep the backend single-worker because tickets/socket routing are in-process; outstanding tickets expire across restart and clients mint replacements/reconcile history. [Volume limitations](https://docs.railway.com/volumes/reference).

## Explicit first-time migration/seed

Startup already runs migration after mount. **Do not configure Alembic as a build/pre-deploy command.** After a healthy backend deployment, open its remote shell using the dashboard's copied SSH command or:

```sh
railway ssh --project <PROJECT_ID> --environment production --service backend
```

Inside the deployed container, from its application root (normally `/app`):

```sh
test "$DATABASE_PATH" = /data/signal.sqlite3
test "$RAILWAY_VOLUME_MOUNT_PATH" = /data
python -m alembic current
python -c 'import sqlite3; from contextlib import closing; c=sqlite3.connect("file:/data/signal.sqlite3?mode=ro", uri=True); print("users:", c.execute("select count(*) from users").fetchone()[0]); c.close()'
```

Only if this is the intended fresh DB at revision `0001` with **zero users**, run:

```sh
python -m app.seed
```

Expected inserts: 4 users, 6 contacts, 3 conversations, 7 members, 6 messages, 8 receipts. Sample usernames: `alice`, `bob`, `carol`, `dave`; fixed OTP `123456`. These profiles are fictitious and impersonable by design; never enter personal/sensitive data. Seed is repeatable and does not reset populated records, but a surprise nonempty DB must be investigated before seeding. No auto-seed on restarts. `railway run` runs locally with Railway variables and is **not** the remote mounted-volume seed procedure. SSH requires authorized CLI/key setup; no CLI login/key registration was performed in preflight. [Railway remote SSH](https://docs.railway.com/cli/ssh).

## HTTPS/WSS acceptance after deployment

1. Open the frontend **HTTPS** URL in two independent browser profiles/incognito contexts. Log in Alice and Bob with the disclosed mock OTP. Confirm identities survive reload independently.
2. Inspect frontend Set-Cookie: `scaler_session`, **HttpOnly; Secure; SameSite=Lax; Path=/**, expiration, **no Domain attribute**. `document.cookie`, storage and JSON auth responses must not expose its opaque session value. Current code derives Secure from configured HTTPS Origin, not proxy headers.
3. Browser REST calls stay on `/api/...` at the frontend. Next forwards to the fixed backend origin using its private key and cookie-derived identity; no arbitrary proxy target or browser-supplied bearer identity is honored. Mutations require the exact Origin and session CSRF token. Missing/mismatched CSRF or Origin must return 403. Direct backend REST without gateway key must be denied.
4. Network panel: POST `/api/auth/ws-ticket` succeeds with CSRF, then `wss://<BACKEND_DOMAIN>/v1/ws` upgrades. First outgoing frame is `{v:1,type:"auth",payload:{ticket:...}}`, followed by server `ready`. Ticket is single-use, expires in 30 seconds and is Origin/session-bound. **No session or ticket in URL/query, logs or persistent storage.** Avoid saving network traces containing live credentials.
5. Alice sends a fictitious message in their direct chat; Bob receives it without refresh. Bob replies; both see one committed copy. Reload both; messages persist. Wrong-user conversation IDs must return 403/404 and an unapproved socket Origin must fail. Temporarily disconnect/reconnect a browser and confirm history reconciliation.
6. Check no mixed-content, certificate, framework or application console errors. Railway supports HTTPS and WebSocket over HTTP/1.1, but the actual two-domain WSS/TLS path remains unverified until deployment. [Networking specifications](https://docs.railway.com/networking/public-networking/specs-and-limits).

Do not interpret current sent acknowledgment as implemented live delivered/read progression; that is still a later phase.

## Persistence, backup and rollback

Before migration/schema changes, take a consistent SQLite backup, preserve code revision and Alembic revision, and verify restore on a disposable DB. Use Python's SQLite backup API while running; copying only a live `.sqlite3` file can omit WAL changes. Example **inside the remote backend shell**, not on the developer machine:

```sh
python - <<'PY'
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
folder = Path('/data/backups')
folder.mkdir(exist_ok=True)
target = folder / ('signal-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid4().hex[:8] + '.sqlite3')
with closing(sqlite3.connect('file:/data/signal.sqlite3?mode=ro', uri=True)) as source, closing(sqlite3.connect(target)) as backup:
    source.backup(backup)
    assert backup.execute('PRAGMA integrity_check').fetchone() == ('ok',)
print(target)
PY
```

Download the consistent backup via authorized SSH/SFTP/volume tools to protected off-host storage; it contains sessions and must never enter the public repo. A second file on the same volume alone is not disaster recovery. Consider manual/scheduled Railway volume backups after budget approval; dashboard backend → Backups offers restore by timestamp and stages a replacement mounted volume while retaining the old one. Backup charges/retention must be reviewed in the paid workspace. [Railway backups](https://docs.railway.com/volumes/backups).

Persistence test: record a direct-message body/ID and revision; restart backend in Railway, reconnect/reload both clients, verify the same message once. Redeploy the backend from unchanged approved source; repeat. Confirm `/data` remains attached and sample counts have not increased from automatic seeding. Repeat frontend redeploy and verify WS URL remains correct. Expect brief backend downtime and reconnection, not lost records.

Rollback strategy:

- If only application code changed and schema remains compatible, select the previous successful deployment/version, retaining the same volume, Origin and key. Validate health, sessions and two-user exchange afterward; changing WS domain still requires a frontend rebuild.
- A failed migration prevents server startup; inspect the actual Alembic revision and database integrity before retrying. Do not assume every failed migration left no partial changes.
- For an incompatible/data migration, stop writes and stop the backend with restart policy disabled. Restore a verified **pre-migration** Railway volume backup and compatible old source together; review staged mount changes and keep the old volume for recovery. Never restore over a running SQLite process. An offline file restore must replace the DB and handle its WAL/shm only after all connections are closed, with checked paths and a retained safety snapshot; do not delete developer files.
- Do **not** run `alembic downgrade base`: current `0001` downgrade drops the schema/data. There is no proven nondestructive future migration downgrade yet. Prefer snapshot restore; restored sessions/data reflect backup time. Do not auto-seed a restored populated DB.

## Usage safeguards and costs

Owner selects the spending ceiling and alert threshold before provisioning; inspect current paid plan/usage, do not assume included credit covers this demo. Two persistent services consume RAM/CPU; backend volume, retained backups and public REST/WS egress add cost. No Redis/Postgres/extra services or paid custom domain is required. Current listed container rates: RAM $10/GB-month, CPU $20/vCPU-month, egress $0.05/GB, volume $0.15/GB-month, plus the account subscription/credits. Actual billing depends on measured usage; no total estimate is justified yet. [Pricing](https://docs.railway.com/pricing/plans).

Use Workspace Usage alerts and an owner-approved compute hard limit; hard limits take workloads offline. Keep one replica, monitor memory/volume space/error rate, and choose resource caps with enough headroom after observing real metrics. Disable unnecessary auto-deploy/PR environments and avoid public load testing. Current auth limiting groups callers by the observed gateway IP, so users behind Next may share the 30-attempt/minute allowance; monitor demo 429 responses. It does not cap message volume or total account growth. Monitor abuse and restrict/pause the showcase if necessary rather than adding a new platform in this preflight. Keep it available through evaluation; owner decides retention/removal afterward. [Cost control](https://docs.railway.com/pricing/cost-control).

## Local evidence and remaining live gate

- `npm run lint`, `npm run typecheck`, `npm run build`: passed.
- Backend `.venv` Python `-m pytest -q`: **67 passed**, including seven new startup cases (fresh migration/no seed, retaining data on repeat startup, failure before server start, unsafe/missing config and storage).
- `npx playwright test`: **24 passed** (12 desktop + 12 mobile), 44.8 seconds. Existing installed Chromium used; no browser installation/dependency changes.
- Production commands started on env ports 3200/8200 with a fresh ignored temporary SQLite file. Startup migrated; an explicit seed inserted exactly the sample fixture counts. Real Next health forwarding passed.
- A live SQLite online backup of that throwaway DB passed integrity/revision checks and retained all four sample users and eight messages (six fixtures plus the two smoke messages). Actual Railway backup restore remains untested.
- Additional real Chromium smoke: two isolated users connected using Next-minted first-frame tickets, exchanged both directions, and read both messages after actual backend process restart. Two socket `ready` responses and zero page errors in each run. Build WS URL was 8200 while runtime URL was deliberately port 1: connections to 8200 proved build-time embedding. HTTP loopback cookie/CSRF checks passed; **this does not prove HTTPS Secure behavior in Railway**.
- Initial new-test run reported unclosed SQLite connection warnings at teardown; fixed by explicitly closing test connections. Final full suite exited successfully. Windows asyncio emitted a connection-reset callback during socket teardown in E2E/manual stop; no failed assertion/data loss. Linux shutdown behavior is not tested locally.
- No developer SQLite was seeded/migrated/reset. No external changes. Git diff unavailable because no repository exists.
- Temporary production servers were stopped; the normal local build/frontend at `http://127.0.0.1:3000/` was restored. Direct backend health at port 8000 and frontend-forwarded health both returned the expected response. Screenshot evidence: `C:\Users\HarshPC\.codex\visualizations\2026\10\08\01a11b98-36ec-7431-a3fd-6f185920e179\railway-production-desktop.png` (1440×900, throwaway smoke data only).

Live gates: Linux Railpack image/package build, actual mounted-volume permissions, HTTPS cookie header, cross-domain WSS/Origin, restart/redeploy persistence, backup restoration, owner-selected budget and explicit repository/deployment approval. Public URLs are still unassigned. This preflight does not authorize Phase 5 or final submission.
