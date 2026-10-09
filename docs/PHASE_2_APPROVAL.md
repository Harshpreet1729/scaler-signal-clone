# Phase 2 review and Phase 3 authorization

> **HISTORICAL — phase/release record.** Scope, approvals, test counts, database revisions and pending gates below describe that release, not the finished application. See the [current README](../README.md) and [final verification](FINAL_VERIFICATION.md) for shipped features and latest results. This record is retained as evidence, not a new execution instruction.

Date: 8 October 2026
Deadline: Friday 9 October 2026, 6:00 PM IST

## Review status
Phase 2 is accepted for progression **based on Codex's reported tests and user-provided screenshots**, not an independent source-code audit.

Reported evidence: 55 backend tests passing, 10 Playwright tests plus 2 targeted security checks passing, frontend lint/typecheck/build passing, Alembic revision 0001, idempotent seed on rerun, manual registration/reload/logout/seeded-login checks passing. Phase 2 includes eight SQLite tables, mock OTP and persistent sessions, protected Next.js forwarding, user profiles, preset avatars, and seeded users/chats. Preserve all this behavior.

## Decisions
1. Approve the Phase 0 architecture and Phase 2 implementation for continuing development. Do not silently change stack or established database contracts.
2. **Visual reference approval**: Use the official Signal Desktop for Windows, light theme screenshot as the primary reference: https://signal.org/assets/images/screenshots/download-desktop-windows.png . It shows the rail, conversation list, selected group, header and bubble styles but cuts off the composer. Signal's help pages are secondary sources for behavior. The screenshot's exact app version, font metrics and missing-state geometry are unknown.
3. To meet the deadline, approve **clearly recorded approximations** for the composer, selected direct chat, empty state, search results, settings and open menus/modals. This is approval to proceed, **not permission to claim pixel-perfect fidelity** or invent source-backed dimensions.
4. Desktop light theme is the fidelity target. Narrow-screen usability is required for testing; complete mobile parity/dark mode are bonuses and should not displace core functionality.
5. The web app may use original/local icons and illustrative avatars; do not copy third-party repository source or unlicensed brand assets. Clearly label mock end-to-end encryption; do not imply actual E2EE.
6. For this phase, visual mock content may only live in isolated fixtures/adapters. Do not claim real-time events or successful sends until the backend is connected in later phases.
7. Hosting is planned for a paid Railway account: separate Next.js and FastAPI services, durable volume for SQLite, single backend worker/replica. No deployment or spending is authorized by this document.

## Priority and stopping rule
Proceed with **Phase 3 static Signal UI** only. Preserve Phase 2 authentication/database. Provide test results and screenshots; stop for review before Phase 4. The final user must be able to distinguish visual-only elements from implemented features.
