# Final Signal Desktop fidelity pass — 9 October 2026

Baseline / rollback: `86e51c112036a1ce676d8ce65527ac8939df4da6`. User-supplied Windows captures R1–R7 are the primary reference. All seven were opened before editing. Personal screenshots remain outside this repository; no contact content is transcribed. Original components/icons only, no Signal source or artwork copied.

## Scale and pre-change audit

The full reference is approximately1917px wide, with app content about958px high after excluding taskbar/chrome. Its DPI/zoom is unknown. Comparing it with a1440×720 CSS-pixel viewport gives a width normalization factor1.33125, not a claim about Windows display scaling. Raw rail boundary near99px becomes74.4px; raw400px sidebar becomes300.5px. Thus widening the rail to100CSSpx would be incorrect. Standard1440×900 and390×844 captures supplement this proportional comparison.

Actual baseline at1440×720, devicePixelRatio1: rail74px; sidebar292px; main startsx366; sidebar/chat headers48px; composerx384,y664,w1038,h46. Bottom controls occupy92px, including a redundant avatar. Reference combined left boundary499/1917≈26.03% versus clone366/1440≈25.42%.

| Priority / region | Current measured or observed gap | Intended change | Risk |
|---|---|---|---|
| P0 R2/R5 rail | Gear plus avatar; bottom stack92px; Chats startsy54 rather than normalized≈45 | One centered gear, anchored bottom; active Settings; original consistent icons; retain74px rail | Low |
| P0 R4/R5 Settings | Centered680px modal obscures chat | Full-height sidebar and detail pane; actual demo profile, truthful disabled preferences; preserve draft/session/selection | Medium: navigation/focus/read visibility |
| P0 R7 New chat | Center modal with contact list | Left-sidebar back/search/actions/contacts using existing APIs | Medium: search/selection/modal transitions |
| P1 R1/R3 list |292px versus normalized≈300px; permanent36px connection strip; top-aligned empty illustration |300px desktop sidebar; centered text empty state; accessible connection status with visible reconnect feedback | Low |
| P1 R1 main empty | Generic gray symbol, selection instruction | Original blue conversation glyph and concise demo welcome; no official identity claims | Low |
| P1 R3 composer | Plus left, emoji inside, persistent send circle | Separate emoji left; input; honest disabled mic/attachment right when empty; send with draft | Medium: keyboard/draft/typing regression |
| P1 R3 bubbles/header | Existing blue/gray grouping, inline receipts and48px header already proportionally close | Preserve behavior; refine canvas/spacing only where captures support it | Low |
| P2 R6 dialogs |12px radius noticeably squarer than reference | Softer24px corners and retained accessible forms; no delete-data action | Low |

Pre-change empty/chat/settings/new-chat/mobile captures and numeric geometry are retained in the private `fidelity/` artifact folder, not Git. Checkpoints A (rail/list), B (shell navigation), C (composer/dialogs) receive targeted real-browser validation before the final regression run.

## Implemented and verified locally

- A: one bottom gear,74px rail,300px sidebar, Chats beginsy45, gear centerx36.5 and bottom inset9px. At390×600 the rail is56px, sidebar334px and gear centerx27.5. No horizontal overflow. Empty sidebar text is vertically centered; original welcome glyph/text replaces official branding. Normalized combined boundary now374/1440≈25.97%, within0.06percentage points of the reference.
- B: full-height Settings sidebar/detail (detailx374,w1066,h720 at1440×720), centered76px demo avatar and676px maximum field cards. Categories reflect supported demo scope. Profile/logout remain reachable. New Chat is a sidebar with back, autofocus search, real contacts/directory/direct creation and existing group/contact dialogs. No phone lookup, identity badge, donation or backup claim. Desktop selection/draft survive Settings; mobile index/detail/back is an explicit adaptation. Mobile Back still closes a chat and discards its unsent draft, as before.
- C: separate emoji control, rounded32px empty input, disabled microphone/attachment controls, real send with a draft; Enter/Shift+Enter retained. Desktop composer input begins nearx424, matching the normalized reference≈424. Bubble grouping/receipts retained, canvas softened, existing forms use24px corners. No destructive action added.
- Settings hides the mounted chat and disconnects its read observer. A real two-user test confirms delivery while hidden and reading only after return. Typing stops when leaving the chat view.
- The complete run exposed initial history being mistaken for explicit pagination on mobile. Scroll preservation now requires a real Load Older request; initial/recovery history opens at the latest message. Receipt/recovery/pagination tests pass without changing receipt semantics or backend code.

Browser plugin not available; used installed Playwright with actual Next/FastAPI servers, isolated SQLite, existing Chromium, and desktop/mobile screenshots. No browser installation or dependency change. Page identity, nonblank rendering, no framework overlay, keyboard focus, functional interactions, console/page errors and geometry were checked by existing and new regressions.

| Validation | Actual result |
|---|---|
| Checkpoint A desktop geometry |1 passed |
| Checkpoint B navigation/auth |5 passed,1 failed initially (new test incorrectly expected mobile Back to retain a draft); corrected to the existing lifecycle |
| Checkpoint B/C targeted workflows |8 passed |
| First complete browser run |36 passed,1 failed,1 skipped; exposed initial-history scroll bug |
| Focused receipt/recovery after fix |7 passed,1 skipped |
| Final complete `npx playwright test` |37 passed,1 skipped,2.1minutes; skip is desktop-specific hidden-selected-pane scenario on mobile; mobile receipts are exercised by the existing progression test |
| Final empty-state alignment / real new-thread checks |4 passed on desktop/mobile; screenshots wait for a connected socket |
| Backend `.venv/Scripts/python.exe -m pytest` |78 passed,12.14seconds |
| `npm run lint`, `npm run typecheck`, `npm run build` |Passed |

Forced socket closes can log Windows Proactor connection-reset warnings in the local test server; socket recovery assertions pass. Private artifacts: `fidelity/before-*.png`, `fidelity/local-final/`, `fidelity/empty-final/`, and `fidelity/full-regression.log`. All test content is fictitious. Production results/screenshots are recorded separately after the single deployment commit, rather than creating a documentation-only redeployment.

## Five remaining visual differences / deliberate limitations

1. Original conversation glyph, preset avatars and equivalent SVG icons differ from Signal artwork; no trademark logo, verified badge or personal photos copied.
2. Unknown Windows DPI/zoom/font rasterization prevents a pixel-perfect claim. Segoe UI uses the host font; normalized proportional measurements are the evidence.
3. Settings omits unsupported phone/donation/backups and uses honest profile/preference explanations; no fake editing action.
4. New Chat substitutes real username/contact actions for phone lookup and Note to Self. The special Note to Self intro card is deliberately absent.
5. Group/member/create dialogs and mobile navigation are functional original adaptations because these supplied desktop screenshots do not show those states. Typing stays a textual accessible label; no optional animation added.

## Deployment gate and rollback

Only frontend presentation/tests/docs changed. No backend/API/session/CSRF/WS/schema/migration/env/dependency/Railway configuration changes. Before push, read-only production SQLite check: integrity`ok`, revision`0001`,5users,17messages, IDs1–17. No developer/test DB is uploaded. Existing GitHub integration may redeploy both services; no separate backend redeploy is requested and configuration is preserved. Verify deployed commit, HTTPS/WSS, secure cookies, three fictitious sessions, admin denial, unread/search/settings/mobile and old message IDs before final GO. Existing LeetMentor homepage returned200; dashboard reports2/2online, EventGate0/4online, Articles Writer0/2online; none modified. Usage snapshot:$2.87 for Sep20–Oct20, unchanged$10 compute limit; no resource purchase.

Rollback if needed: redeploy baseline`86e51c112036a1ce676d8ce65527ac8939df4da6` to the existing frontend, preserving backend and `/data` volume. No database rollback/reset is needed for this presentation-only change. Do not submit automatically.
