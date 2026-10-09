# Requirements and acceptance checklist

Original Phase 0 checklist, reviewed 2026-10-08. Approved choices and implemented acceptance evidence are recorded in [Phase 5 deployment](PHASE_5_DEPLOYMENT.md) and [Phase 6 QA](PHASE_6_QA.md). The original unchecked boxes below preserve the specification; they are not a current implementation-status report.

Authority: [assignment PDF](../Scaler_SDE_Fullstack_Assignment_-_Signal_Clone.pdf), all four physical pages read and visually inspected. Page numbers below refer to those pages. The PDF contains no UI screenshots. Project rules: [AGENTS.md](../AGENTS.md). Checkboxes mean acceptance is still outstanding, not that documentation has implemented anything.

## Mandatory functionality

| ID | Acceptance condition | PDF | Scenario |
|---|---|---|---|
| M01 | [ ] Register using phone number **or** username; a fixed OTP is allowed. | p. 1, Authentication | E01 |
| M02 | [ ] Set display name and profile avatar. | p. 1, Authentication | E01 |
| M03 | [ ] Login, logout, and preserve sessions across reload. | p. 1, Authentication | E01-E02 |
| M04 | [ ] Left-hand conversation list sorted by most recent activity. | p. 1, Contacts | E03, E10 |
| M05 | [ ] Search conversations and contacts; add a contact. | p. 2, Contacts continuation | E03 |
| M06 | [ ] Show unread indicators and last-message preview. | p. 2, Contacts | E05, E10 |
| M07 | [ ] Show online/last-seen indicators; simulated values are permitted. | p. 2, Contacts | E03 |
| M08 | [ ] Two users send and receive direct text messages in real time. | p. 2, One-on-One | E04 |
| M09 | [ ] Display message timestamps. | p. 2, One-on-One | E04 |
| M10 | [ ] Delivery/read receipts and sending, sent, delivered, read progression, with Signal-style status icons. | p. 2, One-on-One | E05 |
| M11 | [ ] Show typing indicators. | p. 2, One-on-One | E06 |
| M12 | [ ] Persist all messages in the database. | p. 2, One-on-One | E04, E07, E12 |
| M13 | [ ] Create a named group with members. | p. 2, Groups | E09 |
| M14 | [ ] Send/receive group messages and view membership. | p. 2, Groups | E09 |
| M15 | [ ] Admin controls add/remove members. | p. 2, Groups | E09 |
| M16 | [ ] Persist all group data and messages. | p. 2, Groups | E09, E12 |
| M17 | [ ] Recreate Signal navigation, conversation list/chat pane, bubbles, and threading. | pp. 1-2, Description/Signal Experience | E11 |
| M18 | [ ] Signal-like forms, modals, search, and filters. | p. 2, Signal Experience | E03, E11 |
| M19 | [ ] Notifications/toasts. | p. 2, Signal Experience | E10-E11 |
| M20 | [ ] Privacy, notifications, and appearance settings placeholders. | p. 2, Signal Experience | E11 |
| M21 | [ ] Seed multiple users, conversations, and messages so the app is immediately usable. | p. 3, Important Notes | E12 |

## Permitted mocks and placeholders

| ID | Permitted scope | PDF |
|---|---|---|
| P01 | Fixed OTP, mocked phone verification and cryptographic key exchange. Authentication/session persistence must still work. | p. 1 |
| P02 | Mocked online/last-seen values. | p. 2 |
| P03 | Voice and video calls may display Coming Soon. | p. 2 |
| P04 | Stories may display Coming Soon. | p. 2 |
| P05 | Linked devices may display Coming Soon. | p. 2 |
| P06 | Actual end-to-end encryption may be simulated. | pp. 1-2 |
| P07 | Settings categories may be placeholders, as required by M20. | p. 2 |

P03-P06 are permitted sections, not extra mandatory functioning features. Any displayed security claim will state this is a demo without real E2EE. The server stores readable message text; transport TLS does not change that.

## Optional bonuses: only after mandatory acceptance

| ID | Optional item | PDF |
|---|---|---|
| B01 | Image/file attachments | p. 2 |
| B02 | Emoji reactions | p. 2 |
| B03 | Reply-to/quoted messages | p. 2 |
| B04 | Functional disappearing messages | p. 2 |
| B05 | Dark mode | p. 3 |
| B06 | Responsive mobile/tablet/desktop design | p. 3 |
| B07 | Keyboard shortcuts | p. 3 |

## Constraints, deliverables, and evaluation

| ID | Acceptance condition or constraint | PDF |
|---|---|---|
| C01 | [ ] Next.js with TypeScript frontend. | p. 1, Technical Stack |
| C02 | [ ] Python backend using FastAPI or Django; this project selects FastAPI. | p. 1 |
| C03 | [ ] SQLite with an original schema; schema design is evaluated. | pp. 1, 3 |
| C04 | [ ] Real-time mechanism; PDF permits WebSockets or another choice, project selects WebSockets. | p. 1 |
| C05 | [ ] Study Signal before UI work; match original design/UX closely, including the PDF's explicit exact-look-and-feel instruction. | pp. 1, 3 |
| C06 | [ ] Original work; plagiarism from existing repositories causes disqualification. | p. 3 |
| C07 | AI assistance is allowed and encouraged; [ ] student understands every submitted line and can explain decisions. | p. 1 |
| C08 | Estimated effort approximately 24 hours; PDF says deadline is communicated separately. Owner-confirmed deadline: 9 October 2026, 6 PM IST. | p. 4 + owner instruction |
| D01 | [ ] Public GitHub repository containing `frontend/` and `backend/`; upload code and ensure public visibility. | p. 3, Deliverables/Submission |
| D02 | [ ] README: setup, stack, architecture, schema, API overview, assumptions. | p. 3, Important Notes/Deliverables |
| D03 | [ ] Hosted working application; cloud provider is flexible (Vercel, Netlify, Render, Railway are examples). | p. 3 |
| D04 | [ ] Submit both public GitHub URL and deployed application URL. | p. 3 |
| V01 | [ ] Functionality: all core features correct, including real-time messaging. | p. 3, Evaluation |
| V02 | [ ] UI/UX: visual similarity and original UX patterns. | p. 3 |
| V03 | [ ] Database design: well-structured schema and relationships. | p. 3 |
| V04 | [ ] Backend/API design: clean, sensible API and architecture. | p. 3 |
| V05 | [ ] Code quality: clean, readable, organized code. | p. 3 |
| V06 | [ ] Modularity: separation of concerns and reusable components. | p. 3 |
| V07 | [ ] Understanding: explain the code at evaluation. | p. 3 |

## Project rules and interpretations, separately sourced

These are from AGENTS.md or proposed design decisions, **not additional PDF quotations**:

- Approval at every phase; only documentation in Phase 0. No dependencies, application code, deployment, remote commit/push, or paid resources now.
- Relational migrations, repeatable seed, durable hosting, authenticated WebSockets, authorization on every contact/conversation/member operation, secret-free `.env.example`, and relevant checks at each phase.
- Seed contacts and groups as well as the PDF's explicit users/conversations/messages.
- Visual comparison includes desktop and a mobile viewport under AGENTS.md. Full responsive product behavior remains a PDF bonus; minimum narrow-screen usability and QA are a project baseline. Approve this distinction.
- Interpret “threading” as chronological conversation history with adjacent same-sender grouping/date separators. Quoted replies remain B03.
- Propose username-only mock registration (the PDF says phone **or** username), a selectable preset avatar, All/Unread filtering, and in-app toasts. Phone registration, avatar uploads, OS push notifications, arbitrary filters, and message-content search are not assumed mandatory.
- Directories/public repository/hosted link are final deliverables; their absence in Phase 0 is intentional.

See [acceptance scenarios](ACCEPTANCE_TESTS.md), [architecture](ARCHITECTURE.md), [schema](DATABASE_DESIGN.md), [visual evidence](SIGNAL_UI_REFERENCE.md), and [approval gates](PHASE_PLAN.md).
