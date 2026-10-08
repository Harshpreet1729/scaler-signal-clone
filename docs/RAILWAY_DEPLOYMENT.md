# Phase 4 production deployment — 9 October 2026

This is the authorized early deployment, not completion of Phase 5 or the full assignment. Both services use Railway; previous Netlify proposals are superseded. No subscription upgrade, billing-limit change or existing-project redeployment occurred.

## Public endpoints and source

- Repository: https://github.com/Harshpreet1729/scaler-signal-clone (public, main).
- Frontend: https://frontend-production-5f84.up.railway.app/
- Backend health: https://backend-production-5383.up.railway.app/v1/health/live
- Frontend health forwarding: https://frontend-production-5f84.up.railway.app/api/health/live
- Browser WS: `wss://backend-production-5383.up.railway.app/v1/ws`.
- Deployed application source: `c20ad08ceefa1732800cb18690f3aa5594eb253c`. This handoff commit changes documentation only.
- Project `scaler-signal-clone`: `79d07114-2882-4fe7-8e95-48b617074324`; production environment `29f183e9-2fc2-4e97-b046-10edd11ee361`.

Log in with fictitious accounts `alice`, `bob`, `carol`, `dave`; public mock OTP `123456`. Anyone can impersonate these demo accounts. Use fictitious messages only. This application has **no real end-to-end encryption**.

## Applied service configuration

| Setting | frontend | backend |
|---|---|---|
| Service ID | `ee3a9910-3dcc-4d62-bd60-8a8ecb2cdfe3` | `e26d18c6-26c9-4abe-9dca-bbcad71ddba8` |
| Root | `/frontend` | `/backend` |
| Builder | Railpack 0.40.1 | Railpack |
| Runtime | Node 24.13.0, npm 11.6.2 | Python 3.13.12 |
| Build | `npm run build`; default Corepack/install step | pinned requirements installation |
| Start | `npm run start:production` | `python -m app.startup` |
| Port/bind | Railway `PORT=8080`, `0.0.0.0` | same; one Uvicorn worker |
| Healthcheck | `/api/health/live` | `/v1/health/live` |
| Region/replicas | us-west2 / one | us-west2 / one |
| Serverless | off | off |
| Persistent storage | none | fresh `backend-volume`, `/data` |
| Pre-deploy migration | none | **none**: migration runs after mount in startup |

Both services have exact `FRONTEND_ORIGIN=https://frontend-production-5f84.up.railway.app`. Frontend has fixed server-only `BACKEND_BASE_URL=https://backend-production-5383.up.railway.app`; `NEXT_PUBLIC_WS_URL` was set to the final WSS endpoint **before** the successful build. Backend uses `DATABASE_PATH=/data/signal.sqlite3` and Railway-provided `RAILWAY_VOLUME_MOUNT_PATH=/data`. A generated 64-character gateway key was set identically via CLI stdin; its value is absent from source and this report. Public backend HTTPS forwarding works; private-network forwarding has not been substituted or tested.

The initial frontend build compiled but failed image export because a custom install override skipped Corepack preparation. Removing `RAILPACK_INSTALL_CMD` fixed this. Successful frontend deployment `08dc2adb-17cd-406d-a994-4efd896c2353` used a clean archive of committed source only. GitHub source remains connected. Backend was built from GitHub; successful persistence redeployment is `8cc3262f-67cd-4d4e-900f-48098b1dd5d1`.

The dashboard initially displayed **Auto deploy unavailable** while source settings were being staged. After connection completed, the documentation push `0bcc701` triggered actual GitHub deployments for both services, so push deployment is now verified. No GitHub App permissions were changed. For a manual recovery use the explicitly selected service's repository deployment/redeploy, or a clean tracked-source archive with `railway up`; never upload the developer working directory without verifying exclusions. Changing the public WS hostname requires rebuilding Next.js.

## Fresh database and seed

Remote checks before seeding: Alembic `0001 (head)`, zero users, `PRAGMA integrity_check=ok`. Explicit `railway ssh --service backend --environment production -- python -m app.seed` inserted 4 users, 6 contacts, 3 conversations, 7 members, 6 messages, 8 receipts. No developer database was uploaded. Startup never seeds or resets the database.

After live QA and actual restart/redeploy: **4 users, 8 messages, revision 0001, integrity ok**. Two extra messages are fictitious Alice/Bob deployment verification text, IDs **7 and 8**. Neither reseeding nor duplicate inserts occurred. The volume has a 5 GB capacity ceiling; billing is based on stored data, not full capacity. Initial dashboard size reporting was still `0.00 MB`, so do not interpret it as an empty database.

## Actual validation

| Check | Result |
|---|---|
| Local lint / typecheck / production build | passed |
| Backend pytest | **67 passed** |
| Existing Playwright desktop/mobile suite | **24 passed**, 48.5 s |
| Public deployment browser smoke | **9 check groups passed**, two isolated Chromium contexts |
| Public WSS negative checks | **2 passed**: wrong Origin → HTTP 403; invalid ticket → 4401 |
| GitHub | repository verified PUBLIC, main pushed |
| HTTPS health | backend and actual Next forwarding return expected deterministic JSON |
| Login/cookies | independent Alice/Bob identity; Secure, HttpOnly, SameSite=Lax, Path=/, no Domain attribute; no session token in browser JSON/storage/document.cookie |
| Access controls | wrong/missing Origin, missing CSRF, direct backend gateway bypass denied; Bob cannot read Alice/Carol conversation |
| WSS | real browser connections use final WSS URL, no query credentials; first sent frame authenticates with Next-minted short-lived ticket; server ready received |
| Direct messaging | two-way rendered Alice/Bob exchange without recipient refresh; one committed copy each |
| Reload/restart/redeploy | existing sessions and exact message IDs retained; clients reconnect after actual restart; mounted-volume redeployment succeeds |
| Database | integrity ok, revision 0001; four seed users preserved |
| UI | signed-out and signed-in in-app browser check; 1440×900 desktop, group placeholder and 390×844 screenshots captured after history rendered; no page errors |

Transient QA launcher failures were corrected: SSH shell quoting, then a Windows child-process CLI invocation/path timeout. They did not indicate app failures. Restart was finally driven through the working CLI while the two browser contexts stayed open. Screenshot capture initially raced history loading; captures were replaced after awaiting the real persisted bubbles. Local Windows E2E emitted connection-reset callback/NO_COLOR warnings during teardown; all assertions passed. No new browser/package installation was needed. Production screenshots/scripts/results remain outside the public repository; no cookies or traces were saved.

## Budget and protected projects

Dashboard at verification: workspace **$2.84 accrued**, historical forecast **$4.67**, hard limit **$10 unchanged**; Signal project metered **$0.0004** at that early snapshot. Usage/forecasts lag deployment changes; these are not full-month costs.

Runtime cgroup memory snapshots under QA: frontend **120,082,432 bytes (~120 MB)**; backend **76,800,000 bytes (~77 MB)**. At $10/GB-month, maintaining these levels costs approximately **$2/month combined RAM**, plus CPU, SQLite/storage and outbound traffic. With the observed LeetMentor baseline and retained volumes, budget approximately **$3.50–$5.50 resource usage/month at low traffic**, meaning roughly **$5–$5.50 total Hobby bill before any tax**. Reserve the remaining ~$4.50 of the $10 ceiling for growth and measurement uncertainty. This is an extrapolation from short snapshots, not a guaranteed steady-state forecast. Persistent WS connections/background work mean no idle-sleep discount is assumed.

Railway rates: RAM $10/GB-month, CPU $20/vCPU-month, stored volume data $0.15/GB-month, egress $0.05/GB. Hobby includes the first $5 usage in its $5 subscription. [Official pricing](https://docs.railway.com/pricing/plans). Reaching the unchanged hard limit can interrupt **all** workspace projects, including LeetMentor. Public mock accounts do not provide a traffic/cost cap. No extra subscriptions or upgrades were purchased.

LeetMentor public homepage returned HTTP 200; its configuration/database were untouched. EventGate's four services were verified offline with autodeploy disabled; its retained database volumes still incur storage. Articles Writer was untouched; its existing volumes remain. No EventGate volume/service deletion was performed in this deployment task.

## Remaining scope and operations

- Group writes/sending/admin membership, typing and live delivered/read acknowledgments remain Phase 5. Seeded group history/status examples do not implement those live features.
- No load test, full-cycle billing observation or disaster-recovery restore has been verified. Automatic GitHub push deployment was observed after the source connection completed.
- Railway's current dashboard restricts creating managed backups/PITR to Pro. No upgrade was made. Before future schema changes, use a consistent SQLite backup API snapshot and download it to protected off-host storage; see the backup/rollback recipe in `RAILWAY_DEPLOY_PLAN.md`. A same-volume copy alone is not disaster recovery.
- Source-only rollback must retain `/data` and match migration compatibility. Do not run `alembic downgrade base`; it drops the initial schema/data. Never re-seed/reset a populated public DB on restart.
- Pause for owner review. Deployment authorization does not authorize Phase 5.
