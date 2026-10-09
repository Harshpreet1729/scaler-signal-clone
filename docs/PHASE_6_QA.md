# Phase 6 submission QA — 9 October 2026

Scope: final review and small fixes over approved Phase5 commit `4bd7cb308bc1da7b7f4ca82e230b9f4b395e8681`. No new feature, dependency, backend/auth/database/migration change, resource provision or other-project operation. Local candidate passes; final production commit must pass the short public smoke before the owner receives GO. The post-push smoke results and screenshots are retained outside Git and included in the completion report, avoiding a second documentation-only deployment.

## Reference comparison and findings

Compared the saved official Windows804×490 PNG with actual integrated desktop1440×900,1280×800,1024×768 and mobile390×844 captures. Approval: PHASE_2_APPROVAL.md. Native title bar excluded. Reference is cropped before composer; exact release/font metrics are unknown. Missing-state/mobile treatments remain approved approximations, not pixel-perfect claims.

| Surface | Actual observation / action |
|---|---|
| Rail/sidebar |74px rail and292px list follow reference separation/density. Search/filter,44px circular original avatars, selected rounded gray row, stronger names, muted preview/time and blue unread badge retain hierarchy. No redesign needed. |
| Bubbles/receipts | Blue outgoing, gray incoming, group sender color/avatar, grouped corners and timestamp/status align with reference. Original single/paired outlined receipt circles and filled read state retain accessible status labels/tooltips. Short histories naturally leave whitespace; no artificial messages added for layout. Full sender display name now shown rather than first two words only. |
| Composer/caption | Removed “Sent · Delivered · Read acknowledgments”: repeated implementation detail does not belong beneath every message draft and consumes narrow-screen space. Status icons/tooltips and README explain semantics. Real unavailable messaging notice remains conditional. Composer stays anchored; no overlap/clipping at tested sizes. |
| Typing | Dedicated line above composer is readable and never covers bubbles; start/clear/expiry verified with real sockets. Exact typography/geometry is an approved missing-state approximation. |
| Settings | Disabled privacy switches previously appeared off although features were enabled. They now display checked while remaining disabled, with explicit preference-placeholder wording. No fake preference writes. Mock presence, calls/stories and no-E2EE explanations retained. |
| Older history | New focused check proved loading earlier messages fetched them but jumped to bottom. Small scroll effect now distinguishes prepended history from append/initial load; earlier page stays in view. Existing recovery test covers both desktop/mobile. No history/API refactor. |
| Dialogs/group controls | Native focus trap, Escape and opener restoration; scrollable mobile settings/member panels; readable rename/member search controls. Admin writes work; nonadmins see no admin controls. No significant unresolved layout problem observed. |
| Onboarding/errors/empty/search | Original avatar selection, public demo OTP, username/display-name validation, wrong OTP recovery, reload/logout, empty fresh account, no-result/clear-search and unread filter pass existing regressions. Web onboarding and empty state remain approved custom adaptations. |
| Metadata/docs | Replaced misleading “static conversation preview” page metadata with implemented real-time features and no-E2EE wording. README clarifies local versus mounted-volume production migrations, publishes Phase5 evidence and retains setup/demo accounts/architecture/schema/API/URLs/limitations. Historical Phase0 docs now point to execution evidence. |

## Actual validation

| Check | Result |
|---|---|
| Focused history test before fix |1 failed as expected: older receipt anchor viewport ratio0 after earlier-page fetch |
| Relevant `npx playwright test -g 'register, wrong OTP\|seeded conversations\|chat menus\|real-data screenshots\|two sessions exchange\|reconnect repairs\|group creation\|real typing\|offline sent'` |18 passed,1.5minutes; desktop/mobile; real Next/FastAPI and isolated SQLite |
| Backend `.venv/Scripts/python.exe -m pytest` |78 passed,8.89seconds |
| Frontend lint / typecheck / production build |All passed after final code changes |
| Prior complete Phase5 suite |32 passed; reused for unchanged routes, security/recovery cases rather than rerunning the full browser suite |

Installed Chromium reused; no dependency/browser install. Benign Node color and Windows socket-close teardown notices remain. No test skipped or assertion weakened. Existing tests were extended for checked-disabled privacy controls, absent caption and visible older history. Backend/auth/schema unchanged.

Acceptance trace: E01 onboarding and E03 search/contact/filter current regressions; E02 sessions/E04 live persistence current regression plus actual Phase5 public restart; E05 receipts/unread and E06 typing current regressions; E07 recovery current multipage/older-receipt test; E08 authorization current backend78 and Phase5 public denial checks; E09 group/admin current three-user E2E; E10 unread/toasts/recent activity existing/current tests; E11 captures/dialog/settings/geometry current review; E12 fresh seed/idempotency backend tests and public repo/volume evidence. A new clean-machine installation and real-device soft keyboard were not independently reproduced in this phase.

## Evidence, deployment and owner handoff

Local logs/captures: `C:/Users/HarshPC/.codex/visualizations/2026/10/08/01a11b98-36ec-7431-a3fd-6f185920e179/phase6/`. `history-before.log` records the observed defect; `regression.log` records18 passes; browser geometry test captures direct/group/empty/member/create/settings across four sizes. Phase5 public evidence remains in PHASE_5_DEPLOYMENT.md.

The authorized push uses the existing public main and existing two Railway services. Preserve `/data/signal.sqlite3`, one worker/replica, exact HTTPS Origin, fixed server-only backend URL and configured build-time WSS URL. No seeding, reset, secret rotation or billing change. Short post-push smoke must confirm both deployment hashes, HTTPS health, cookie-authenticated WSS, direct/group message rendering/read/typing, corrected settings/caption, reload and older existing message IDs. No additional restart is needed: backend behavior is unchanged and Phase5 actual restart already passed; this automatic redeploy also verifies volume continuity.

Submission URLs:
- https://github.com/Harshpreet1729/scaler-signal-clone
- https://frontend-production-5f84.up.railway.app/
- Health: https://backend-production-5383.up.railway.app/v1/health/live

Outstanding limits: reference composer/modal/mobile geometry and fonts/colors are approved approximations; Firefox/WebKit, real-device keyboard, load/disaster-recovery/full-cycle billing remain unverified. Public OTP123456 is impersonable, no real E2EE. Optional features remain deferred. No known mandatory defect remains in the validated candidate. Owner must review both links, understand the implementation and submit before18:00IST. Codex will not submit on the owner's behalf or start another development phase.

Changed paths: `frontend/app/layout.tsx`, `frontend/app/messenger/chat-pane.tsx`, `frontend/app/messenger/dialogs.tsx`, `frontend/tests/messenger.spec.ts`, `frontend/tests/phase5.spec.ts`, README and requirements/acceptance/reference evidence docs, plus publishing the existing Phase5 deployment report and this QA record.
