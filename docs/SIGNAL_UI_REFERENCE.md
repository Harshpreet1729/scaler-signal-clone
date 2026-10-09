# Signal Desktop visual reference and approval gate

**Current reference:** Seven owner-supplied real Signal Windows screenshots approved on9October supersede older images for overlapping states. They remain private and are not repository assets. Normalized measurements, ranked differences and implementation evidence: [final fidelity QA](SIGNAL_FIDELITY_QA.md). The earlier [Phase 2 approval](PHASE_2_APPROVAL.md), [Phase 6 QA](PHASE_6_QA.md) and [Phase 3 QA](PHASE_3_VISUAL_QA.md) preserve historical decisions.

Historical Phase 0 research follows. At that time the status was **candidate reference, not approved**. Research/inspection date: 2026-10-08. The assignment has no screenshots. No UI has been built, no Signal/clone source repository has been fetched, and no proprietary UI assets have been copied into this project.

## Candidate baseline and evidence

Propose **Signal Desktop for Windows, light theme**, anchored to the official download-page screenshot below. It is a concrete reference image, not proof of the latest installed Signal release. Its exact application version and capture date are not supplied. Freeze an approved capture set before Phase 3 rather than mixing images from different releases, operating systems, or themes.

| Ref | First-party source | Verified evidence / limitation |
|---|---|---|
| R1 | [Signal download page](https://signal.org/download/) -> [Windows Desktop PNG](https://signal.org/assets/images/screenshots/download-desktop-windows.png) | Opened and visually inspected in browser. Image is 804 x 490; group “Roommates” is selected. Shows Windows title bar, rail, chat list, header, incoming/outgoing bubbles and receipt icons. Cropped before composer/bottom of conversation; no application version. Image dimensions are **not** CSS dimensions. |
| R2 | [Filter by unread](https://support.signal.org/hc/en-us/articles/8406572577818-Filtered-by-unread) | Desktop behavior documented: button beside search toggles unread filter; filtered-state label and clear control. No full layout capture. |
| R3 | [Message status meanings](https://support.signal.org/hc/en-us/articles/360007320751-How-do-I-know-if-my-message-was-delivered-or-read) | Documents sending/sent/delivered/read with icon images. Supports semantics and icon inspection; not a full selected-chat screenshot. |
| R4 | [Typing indicators](https://support.signal.org/hc/en-us/articles/360020798451-Typing-Indicators) | Animated dots and privacy setting documented. Does not establish Desktop geometry. |
| R5 | [Send a message](https://support.signal.org/hc/en-us/articles/360007060212-Send-a-message) | Contact selection/search and Desktop Enter-to-send behavior. No approved composer measurement. |

The older official Desktop beta blog screenshots from 2016 were located but are unsuitable as a modern baseline. The macOS download image exists but is not the chosen platform. R1 includes attachments/reactions; their presence in the reference does not promote PDF bonuses into mandatory scope.

![Official Signal Windows Desktop reference, cropped marketing screenshot](https://signal.org/assets/images/screenshots/download-desktop-windows.png)

## Target by surface

“Observed” below means visible in R1; “proposed” means a design decision still requiring fuller evidence/approval.

| Surface | Target and evidence status |
|---|---|
| Navigation/sidebar | Observed: slim left rail with menu, chats, call and story-like icons, selected rail item and count badges. Separate chat-list column with Chats heading, compose and overflow controls; search and adjacent filter. Preserve the density and separation. Calls/stories can be labeled Coming Soon. |
| Chat rows | Observed: circular avatar, stronger name, muted preview, right-aligned time and unread/status marker. Selected “Roommates” row is a rounded gray surface. Long previews truncate. Use original fictitious names/avatars. |
| Selected chat/header | Observed: white pane; circular group avatar and name at left, call/search/overflow icons at right. Conversation history occupies remaining space. Native Windows window chrome is outside the browser app target. |
| Message bubbles/threading | Observed: blue outgoing bubbles with white text aligned right; pale-gray incoming bubbles left; rounded shapes; group sender names in accent colors, small sender avatars and subtle time/status metadata. Match grouping from fuller reference; no guessed corner radius. |
| Empty state | Not visible. Proposed calm empty pane with a select/start-chat prompt; exact icon, alignment, text, and spacing require approved capture. Do not substitute a decorative dashboard/marketing hero. |
| Composer | Not visible. Enter-to-send documented by R5. Proposed multiline composer anchored beneath history, Shift+Enter newline and disabled blank send. Capture required for exact shape, placement and visible auxiliary controls. Unimplemented media controls must be honestly labeled. |
| Search/filter | Search bar/filter placement observed; R2 supplies unread behavior. Implement contact/conversation results, clear search, empty results, All/Unread. Expanded search-result visual state needs capture. |
| Menus/modals | Overflow/compose launchers observed, open surfaces absent. New contact/group, group members/admin controls, and settings need a consistent approved desktop modal/menu treatment. Do not invent a claim of exact fidelity. |
| Avatars | Observed: circular images in list/header/group sender context. Propose original preset illustrations or initials with stable colors and a selection form; sizes must be measured from approved captures. |
| Typography | Observed: neutral sans serif; clear name/body/metadata weight hierarchy. Font family, weights, sizes and line heights cannot be established reliably from this image. Propose system sans serif until Windows capture is approved; no claim that a particular font is exact. |
| Sizing/spacing | R1 establishes relative hierarchy only: rail narrower than list, chat pane larger than list. Column widths, row height, paddings, icon strokes, bubble width/radius and breakpoints remain unmeasured. |
| Colors | Observed: off-white/gray list, white chat, dark text, muted secondary text, gray selection/incoming bubbles, bright blue outgoing bubbles, blue unread badges. Exact hex/alpha values remain unmeasured; derive tokens after reference approval. |
| Status/errors/toasts | R3/R4 define status semantics. Show real pending/failure/offline states, brief incoming/error toasts and typed validation. Exact toast placement, typing layout and failure controls need approval. |

## Reference package needed to close the gate

Request five captures from **one** Signal Desktop Windows release, light theme, using fictitious or redacted personal data:

1. Full app with a selected direct chat, sidebar, composer, several grouped messages and receipt states.
2. No chat selected, showing complete empty state and sidebar.
3. Search results with unread filter active; include clear-filter affordance.
4. Group chat with membership panel/admin menu visible (capture group creation as an additional frame if possible).
5. Settings or an open modal/overflow menu showing typography, controls and spacing.

Record version, OS, theme, window dimensions, display scale and capture date. Prefer original-resolution captures; no resized social-media crops. If these cannot be supplied, approve R1 plus explicitly marked custom treatments for missing states, recognizing that exact-look-and-feel evidence remains limited. The current recommendation is to obtain the complete set before Phase 3.

## Approval and visual QA procedure

- Approval must identify platform/theme, baseline captures and permitted adaptations (web onboarding, demo status/encryption labels, placeholders). Architecture approval alone is not UI approval.
- After approval, record measured tokens and their source capture. Distinguish measured pixels from responsive implementation choices; do not backfill fabricated values now.
- In Phase 3 compare static states at the same content area/scale; in Phase 6 compare working states. Use side-by-side captures and overlays; inspect column alignment, row density, text wrapping, bubble shape, composer position, icon treatment and selected/hover/focus states. Record discrepancies and fixes.
- Proposed QA viewports: 1440 x 900 desktop, 1024 x 768 tablet, 390 x 844 mobile, all at recorded browser zoom/DPR. These are **test choices**, not dimensions sourced from Signal. Also test the approved reference's exact viewport.
- Desktop is the fidelity baseline. For mobile, minimum project QA checks clipping, scrolling and access to core controls; a full responsive adaptation is a bonus and needs a separate approved reference/design.
- Mask dynamic timestamps/content only when comparing geometry. No “pixel-perfect” claim from a single page render or an unexplained screenshot-diff threshold. Gate closes only after review of all agreed states.

Open items: five-state capture set, exact release, font/measurements/colors, composer/empty/menu appearance, mobile adaptation scope, and explicit user approval. No implementation screenshots exist in Phase 0.
