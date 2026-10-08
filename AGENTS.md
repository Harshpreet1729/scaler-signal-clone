# Scaler Signal Clone: Codex project rules

## Mission
Build an original, interview-defensible Signal-inspired messaging application matching the Scaler SDE Fullstack assignment PDF. Prioritize mandatory functionality, accurate Signal Desktop appearance, correctness, and clear architecture over decorative features. The PDF is the requirements authority. It contains no specific UI screenshots, so design references must be gathered and approved separately.

## Mandated stack
- Frontend: Next.js, TypeScript.
- Backend: Python FastAPI (chosen from assignment-allowed FastAPI/Django).
- Data: SQLite, properly relational schema; migrations and seed data.
- Real-time: WebSockets with authenticated sessions.
- Repository layout: `frontend/`, `backend/`, root README.
- Deployment: two deployable services or equivalent compatible environment with durable storage. Do not assume Codex Sites supports running a Python service and SQLite persistence without verification.

## Mandatory scope
- Mock phone/username registration with fixed/test OTP allowed; set display name and avatar; login/logout; persisted session.
- Contacts: search, add, list conversations in recent-activity order, unread state, last-message preview, mocked online/last-seen.
- Direct messages: two users, real-time send/receive, timestamps, status progression (sending/sent/delivered/read), receipts, typing, persistent history.
- Groups: create, name, add members, send/receive, view membership, admin-only add/remove, durable data.
- Signal-inspired chat list and pane, bubbles, threading, forms, modals, filters/search, toasts, privacy/notification/appearance settings placeholders.
- Allowed placeholders: voice/video calls, stories, linked devices, real end-to-end encryption.
- Seed sample accounts, contacts, chats, groups, messages.
- Required public repo, README with setup/architecture/schema/API/assumptions, hosted functional URL.
- Bonuses only after mandatory features pass: replies, reactions, attachments, dark mode, responsive behavior, shortcuts, disappearing messages.

## Rules for implementation
1. Work in gated phases. At each stage, do ONLY the stage requested. Never start the next phase unprompted.
2. Before changes: inspect existing project state; list a concise plan and affected paths.
3. Prefer simple, understandable code. Do not introduce unnecessary layers, cloud services, state managers, or dependencies.
4. Never clone/copy an existing Signal clone repository. Do not scrape proprietary assets or copy another implementation. Use approved visual references to create original components.
5. Never claim encryption is real. Any lock icon or privacy text must be labeled as demo/simulation when necessary.
6. Implement real functionality, not fake interactivity, for required flows. Persist mandatory records in SQLite, not just browser storage.
7. Use migrations and a repeatable seeding strategy. Account for SQLite durability in production hosting.
8. Require authorization for all conversation, contact, and membership operations; validate WebSocket identity and membership.
9. Never hardcode production secrets or commit `.env`. Maintain `.env.example` without secret values.
10. Run relevant lint/type/build/backend test checks before reporting a phase complete. Report actual commands and results; never invent passing tests.
11. Visual fidelity is a release gate: compare desktop/mobile screenshots against approved reference captures and correct layout, spacing, typography, colors, controls, and interaction states.
12. Do not save/deploy to production, commit/push remote, or create paid resources without explicit approval.
13. Explain implementation choices plainly so the student can defend them in an interview.

## Phase completion report (required)
- Implemented / deliberately deferred
- Files changed
- Commands run and actual outcomes
- Manual QA steps and screenshots if applicable
- Open issues/risks
- Next proposed phase (proposal only; do not execute)

## Acceptance principle
Do not mark a phase done merely because a page renders or API returns 200. Verify required behavior across at least two distinct users/sessions for real-time features.
