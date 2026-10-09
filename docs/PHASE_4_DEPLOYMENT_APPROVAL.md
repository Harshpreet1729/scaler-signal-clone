# Scaler Signal Clone: Phase 4 Deployment Review and Phase 5 Authorization

> **HISTORICAL — phase/release record.** Scope, approvals, test counts, database revisions and pending gates below describe that release, not the finished application. See the [current README](../README.md) and [final verification](FINAL_VERIFICATION.md) for shipped features and latest results. This record is retained as evidence, not a new execution instruction.

Date: 9 October 2026
Hard deadline: Friday 9 October 2026, 6:00 PM IST

## Status and evidence

Approved to proceed with **Phase 5 implementation locally** based on Codex's production report, GitHub documentation and stated test results. This is not an independent re-execution of the live browser tests.

Existing public repository: https://github.com/Harshpreet1729/scaler-signal-clone
Existing Railway frontend: https://frontend-production-5f84.up.railway.app/
Existing Railway backend health: https://backend-production-5383.up.railway.app/v1/health/live
Browser WebSocket endpoint: wss://backend-production-5383.up.railway.app/v1/ws

Production verification reported: 67 backend tests, 24 local Playwright tests, 9 public browser check groups and 2 WSS rejection checks. Alice/Bob bidirectional messaging and SQLite restart/redeploy persistence reportedly succeeded. GitHub public visibility independently verified. Working app remains Phase 4 functionality only.

## Architecture frozen

- Next.js TypeScript frontend on Railway; FastAPI Python backend on Railway; SQLite under a persistent backend `/data` volume.
- One backend worker and one replica, fixed server-side REST forwarding, first-party HttpOnly session cookie, session-bound first-frame WSS ticket, Origin/CSRF controls.
- Do not rotate production keys, delete the volume, re-seed/reset live data, change domains, rename services or add billing resources while implementing Phase 5.
- Public demo OTP is intentionally mock (`123456`); do not claim real end-to-end encryption or use real personal data.
- Preserve existing LeetMentor; EventGate remains stopped; Articles Writer untouched. Railway $10 workspace compute hard limit remains unchanged. Forecasts are not guarantees.

## Authorization scope

**Approve only Phase 5 local source implementation and local tests**, with the existing source/tree and documented behavior preserved. Explicit user approval is required for Phase 5 Git commit/push and Railway production redeployment. At most recommend those actions after checks pass.

Focus exclusively on the assignment's mandatory missing flows: group creation/send/membership/admin actions, actual delivered/read acknowledgements and unread state, typing indicators, and genuine incoming-message toasts. Optional attachments/reactions/replies/dark mode/disappearing messages are out of scope until final acceptance.

## Critical gates

1. Checkpoint A: verified real multi-user group messaging/admin permissions.
2. Checkpoint B: durable monotonic delivered/read receipts and correct unread UI.
3. Checkpoint C: ephemeral authorized typing and no duplicate incoming toasts.
4. Gate: backend pytest, frontend lint/typecheck/build, Playwright desktop/mobile and two or more independent users; report actual results.
5. Stop for owner's review. **Do not push/redeploy**, and never touch the public production DB during Phase 5 implementation.

Reserve sufficient time before 6 PM IST for approved redeploy, production live browser checks, submission URL verification, README and actual submission through the email-associated submission process.
