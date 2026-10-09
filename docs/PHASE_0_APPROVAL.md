# Phase 0 Review and Scoped Approval

> **HISTORICAL — phase/release record.** Scope, approvals, test counts, database revisions and pending gates below describe that release, not the finished application. See the [current README](../README.md) and [final verification](FINAL_VERIFICATION.md) for shipped features and latest results. This record is retained as evidence, not a new execution instruction.

Project: Scaler SDE Fullstack Assignment, Signal Clone
Review date: 2026-10-08
Status: **Approved to proceed to Phase 1 only.** This is a technical review recommendation for the project owner to adopt, not authorization to commit, publish, deploy or spend money.

## Design decisions approved for implementation

1. **Stack:** Next.js App Router and TypeScript frontend; FastAPI backend; SQLite with SQLAlchemy models and Alembic migrations; WebSockets for live events.
2. **Onboarding:** Username-based registration/login using an explicitly marked fixed demo OTP; original preset avatars and editable display names. Real phone verification, real passwords, real E2EE and avatar uploads are outside mandatory scope.
3. **Sessions:** Database-backed opaque sessions using first-party HttpOnly cookies served by a small, fixed-destination Next.js REST forwarding layer. One-use WebSocket tickets authenticate browser connections directly to FastAPI. Enforce Origin, CSRF, session validity and per-conversation authorization as documented.
4. **Runtime:** One FastAPI process/worker, SQLite on durable local storage with WAL and short transactions. This is a deliberate single-instance demo architecture, not an assumed horizontally scalable design.
5. **Group conventions:** Active new members may access earlier group history; removed members lose server access. Snapshot intended recipients when messages are sent; group status is aggregated over that snapshot. Document these as demo conventions, not exact Signal behavior.
6. **Tests:** Preserve E01-E12 as acceptance targets; implement only phase-relevant checks incrementally. Include negative authorization and persistent data tests when the relevant feature is built.

## Not yet approved / unresolved

- **Visual sign-off:** The official Windows/light screenshot is an interim candidate, not a complete approved reference. Before Phase 3, acquire the five missing UI states listed in `docs/SIGNAL_UI_REFERENCE.md`, or explicitly approve approximations with documented fidelity limitations.
- **Production hosting:** No provider, billing, paid resources or deployment approved. Before Phase 7, resolve SQLite persistence, exact prices, availability during evaluation, backup policy and allowed hosting plan.
- **Submission deadline:** Not provided in the PDF; the project owner must confirm the actual communicated deadline.
- **Optional extras:** No attachment, reaction, reply-to, disappearing-message, dark-mode or keyboard-shortcut work until mandatory acceptance passes.

## Phase boundary

**Phase 1 may begin:** Create a minimal frontend/backend scaffold and smoke-test infrastructure. **Do not** implement SQLite schema/migrations, authentication, seed data, final Signal UI, contacts, messaging, groups or deployment until their approved phases.

Review the Phase 1 work and test evidence before authorizing Phase 2. No automatic continuation.
