# Phase 3 visual QA

> **HISTORICAL — phase/release record.** Scope, approvals, test counts, database revisions and pending gates below describe that release, not the finished application. See the [current README](../README.md) and [final verification](FINAL_VERIFICATION.md) for shipped features and latest results. This record is retained as evidence, not a new execution instruction.

Date: 8 October 2026. Status: implementation and checks complete; awaiting the user's Phase 3 visual acceptance. No Phase 4 work authorized or performed.

## Scope and preservation

The existing Phase 3 components were resumed, not rebuilt. Phase 2 registration, login, session restoration, real profile display, logout and protected forwarding remain working. Static chat fixtures are separate from SQLite and explicitly represent Alice's sample perspective, even when another account signs in. No chat/contact/group API, database migration, WebSocket, message write, dependency installation or deployment was added.

Git status/diff could not be obtained: D:\Scalar AI is not a Git repository. Existing files and modification times were inspected instead; no repository was initialized. The assignment PDF and architecture/database/requirements/acceptance/phase-plan documents were preserved.

A read-only logical fingerprint across all rows of the developer SQLite database was identical before/after QA:
`d8f6f40b955d446de6141b55eb3c9fa086159e892f8e4f55869b6157c5373899`.
Browser login/logout/registration tests used a separate temporary database on port 8100, never the developer database. Normal-port browser inspection reused its existing session.

## Reference evidence and approximations

Authority: [Phase 2 approval](PHASE_2_APPROVAL.md), which approves the Windows/light screenshot and explicitly permits documented missing-state approximations.

| Area | First-party evidence | Implementation / approximation |
|---|---|---|
| Rail and sidebar | [Official Windows image](https://signal.org/assets/images/screenshots/download-desktop-windows.png), linked from [Signal download](https://signal.org/download/): narrow rail, gray conversation list, rounded selected row, circular avatars | Original SVG controls; final desktop rail 74px and sidebar 292px, list rows minimum 70px, headers 48px. These are chosen CSS values guided by visible proportions, not verified source design tokens. No native Windows title bar. |
| Typography | Image shows neutral sans-serif, stronger names, muted small metadata | Segoe UI / Arial / sans-serif; 14px body, 18px Chats heading, 10–13px metadata. Exact source font, rendering scale and weights unknown. |
| Colors | Image shows near-white list, white pane, gray incoming bubbles and selection, bright blue outgoing bubbles/badges | Approximate tokens: blue #2868f7; list #f7f7f7; selection #dedede; incoming #eaeaea; text #252525; muted #707070. Not claimed as sampled/exact Signal colors. |
| Avatars | Circular photos in list, header and beside group senders | Existing original Sky/Fern/Sun/Clay SVG presets, original group icon. 44px list, 36px header, 28px group sender. No copied photos/brand assets. |
| Bubbles and grouping | Image shows left gray/right blue, rounded corners, names for group senders, timestamps and receipts | Original bubble CSS, grouped same-sender corners, date separators. 17px base radius and 580px desktop maximum are approximations. Static fictional content differs from reference. |
| Receipts | [Signal status documentation](https://support.signal.org/hc/en-us/articles/360007320751-How-do-I-know-if-my-message-was-delivered-or-read) distinguishes sending, sent, delivered and read | Original SVG sample status marks; accessible names explicitly say “Sample status”. No live progression is claimed. |
| Composer | Primary screenshot is cropped above composer; [send-message guidance](https://support.signal.org/hc/en-us/articles/360007060212-Send-a-message) supplies interaction context | Rounded gray input, accessory buttons, send button, Enter and Shift+Enter. Entire geometry is approved approximation. Blank send disabled; attempted sends explain unavailable and preserve draft without adding a message. |
| Search/unread | Search/filter launcher visible; [unread filter guidance](https://support.signal.org/hc/en-us/articles/8406572577818-Filtered-by-unread) documents filtering/clearing | Local fixture filtering by conversation name/preview and contact name/username; conversation message search; no-results state. Expanded results layout approximated. |
| Group details | [Group management guidance](https://support.signal.org/hc/en-us/articles/360050427692-Manage-a-group) supplies membership/admin context | Right-side modal shows Alice/Admin, Bob and Carol. Add/remove disabled and explained. Panel geometry is not shown by the approved PNG. |
| Empty state, menus and settings | No corresponding approved screenshot | Original restrained empty state, menu, native dialogs, contact/group forms and Profile/Privacy/Notifications/Appearance categories. Controls honestly marked preview; actual identity/logout preserved. |
| Mobile | No approved mobile screenshot | Usability adaptation at <=700px: list/chat switching with Back, full-width chat, compact header, vertically arranged settings. No mobile Signal parity claim. |

The official PNG is 804×490, cropped, with unknown app version/capture date. It was inspected in the Codex browser and through image inspection; the saved reference is QA evidence only, never an application asset.

## Comparison and targeted corrections

Initial in-app inspection showed an overly roomy list/header, a development badge obscuring the profile, and history opening above its latest message. A first 1440×900 Playwright capture was compared visually with the official PNG. Corrections:

- Sidebar reduced from 320px to 292px; rail adjusted from 72px to 74px.
- Headers reduced from 64px to 48px; row minimum reduced from 76px to 70px; search and rail top spacing tightened.
- Chats heading reduced from 19px to 18px/600 weight.
- Native development indicator hidden through supported Next config, leaving compile/runtime error reporting enabled.
- History scrolls to its bottom when a conversation is selected; composer stays anchored.
- Group header derives member count from fixtures.
- Explicit Tab wrapping added to dialogs after a browser test demonstrated focus reaching browser chrome; Escape and opener restoration pass.

Final image inspection covered desktop direct/group/empty, group creation, privacy settings, member details, 1024px group, and mobile list/group/settings. The silhouette, list density, gray/blue hierarchy, circular avatars and bubble alignment now follow the approved reference more closely. The wider 1440px canvas and short fictional histories leave more white space than the cropped reference. This is not a pixel-identical reproduction or a quantitative image-diff claim.

The in-app browser initially returned 728×668 / 1280×720 despite a requested 1440×900 override. Therefore fixed-size evidence uses actual Playwright Chromium screenshots and viewport assertions. After the production restart, old in-app tabs retained connection-error pages; a fresh local tab rendered the authenticated shell and selected direct conversation successfully. The viewport override was reset.

## Interaction checks

| Check | Observed result |
|---|---|
| Auth gate / actual profile | Logged-out visitors see onboarding, not chats; login/register enter shell; actual account avatar/name shown; independent Alice/Bob sessions remain distinct |
| Reload / logout / security | Session restored; Settings logout revokes it; existing cookie/storage/CSRF/Origin/identity checks retained |
| Direct / group selection | Correct header/history; grouped direct bubbles; sender names/avatars and member roles in group |
| Sidebar search / unread | Name/preview matches, empty results and clear filter work; four fixture rows sorted by displayed recency; unread filter yields two |
| Composer | Empty send disabled; Shift+Enter newline; Enter shows preview feedback, retains draft, creates no message and makes no mutation request |
| Menus / dialogs | Arrow-key menu navigation, Escape, modal Tab wrapping and focus restoration pass |
| Contact / group forms | Input validation and local member selection; submit explicitly reports no contact/group created |
| Settings / placeholders | All four categories accessible; nonfunctional toggles disabled; Calls/Stories explain coming soon |
| Mobile / geometry | List-to-chat and Back work; no document horizontal overflow and composer bottom matches viewport at all four sizes |

## Validation actually executed

Windows toolchain retained: Node 24.13.0, npm 11.6.2, Python 3.13.12; Next 16.4.0 / React 19.3.0 / Playwright 1.64.0. Existing Chromium 156.0.8078.4 (revision 1248) used; no browser install or dependency/lockfile changes.

| Working directory | Command | Final result |
|---|---|---|
| frontend | `npm run lint` | Passed, zero warnings |
| frontend | `npm run typecheck` | Passed, strict TypeScript and route generation |
| frontend | `npm run build` | Passed, optimized build; existing nine routes preserved |
| backend | `.\.venv\Scripts\python.exe -m pytest` | 55 passed in 3.58s |
| frontend | `npx playwright test` | 16 passed in 24.7s; 0 failed/skipped |
| frontend | `npm run start` | Local production server ready on 127.0.0.1:3000 |
| local HTTP | GET 3000/api/health/live | Real backend response: `{"status":"ok","service":"scaler-signal-api"}` |

Eight browser tests run in each desktop/mobile project. They start real FastAPI 8100 and Next 3100 against isolated temporary SQLite; no mocked server responses. Runtime error assertions passed. Benign terminal NO_COLOR/FORCE_COLOR notices remain.

Failed intermediate runs are not counted as passes: the first interrupted run hit duplicated Settings clicks introduced while adapting an old test; the next full run was 14 passed/2 failed on dialog focus; after fixing focus, another was 14 passed/2 failed on a case-sensitive “Coming soon” assertion. The final full run above passed after correcting that assertion. No checks were skipped.

## Saved screenshots

All paths below are absolute local QA artifacts. Final captures are from the successful real-service browser test run, before a separately successful production build. Viewports are CSS pixels at device scale 1.

| Capture | Viewport | Exact path |
|---|---|---|
| Official reference | 804×490 source image | `official-windows-reference.png` (local-only evidence; not published) |
| Direct chat | 1440×900 | `desktop-direct-1440.png` (local-only evidence; not published) |
| Group chat | 1440×900 | `desktop-group-1440.png` (local-only evidence; not published) |
| Empty state | 1440×900 | `desktop-empty-1440.png` (local-only evidence; not published) |
| Settings / privacy | 1440×900 | `desktop-settings.png` (local-only evidence; not published) |
| Group creation dialog | 1440×900 | `desktop-new-group.png` (local-only evidence; not published) |
| Group members | 1440×900 | `desktop-members.png` (local-only evidence; not published) |
| Group medium desktop | 1280×800 | `group-1280x800.png` (local-only evidence; not published) |
| Group small desktop | 1024×768 | `group-1024x768.png` (local-only evidence; not published) |
| Mobile list | 390×844 | `mobile-list.png` (local-only evidence; not published) |
| Mobile direct | 390×844 | `mobile-direct.png` (local-only evidence; not published) |
| Mobile group | 390×844 | `mobile-group.png` (local-only evidence; not published) |
| Mobile settings | 390×844 | `mobile-settings.png` (local-only evidence; not published) |
| Mobile group creation | 390×844 | `mobile-new-group.png` (local-only evidence; not published) |
| Mobile members | 390×844 | `mobile-members.png` (local-only evidence; not published) |

## Files and handoff

New Phase 3 files:
- `frontend/app/messenger/{types.ts,fixtures.ts,icons.tsx,primitives.tsx,sidebar.tsx,chat-pane.tsx,dialogs.tsx,messenger.tsx}`
- `frontend/next.config.ts`, `frontend/tests/messenger.spec.ts`
- `docs/PHASE_3_VISUAL_QA.md`

Updated Phase 3 files:
- `frontend/app/{page.tsx,onboarding.tsx,layout.tsx,globals.css}`
- `frontend/tests/{auth.spec.ts,scaffold.spec.ts}`
- `README.md`, `docs/SIGNAL_UI_REFERENCE.md`

This resume targeted existing CSS/chat-pane/primitives, added supported dev-indicator config, updated/extended tests and wrote QA documentation. No backend source changes.

Inspect [local app](http://127.0.0.1:3000/). Existing startup instructions remain in README. Open Bob, Weekend Plans, Chats (empty on desktop), New chat, unread filter and Settings. On narrow screens use Back. Do not expect preview sending or membership edits to persist.

Remaining visual differences: original illustrative avatars/icons replace photographs; exact font metrics/color tokens unknown; composer, direct/empty states and modal/settings geometry are approved approximations; shorter text-only fixtures omit optional media/reactions; mobile is a usability adaptation, with no real-device/soft-keyboard testing. Firefox/WebKit and deployed TLS are not verified. No unresolved required-test blocker remains.

Phase 3 visual acceptance is the next gate. Phase 4 proposal only: authorized contacts/direct APIs and authenticated WebSockets, replace fixtures with persisted histories, then validate two real clients. Group/receipt/typing backend belongs to Phase 5. Railway volume/cost and deployment remain separately gated. Nothing was committed, pushed or deployed.

Work timing: initial Phase 3 work started 20:07 IST, resumed inspection at 20:26 IST on 8 October. Final checks and report were completed around 20:44 IST (about 37 minutes wall-clock span, including the interruption; not a precise active-work timer).

