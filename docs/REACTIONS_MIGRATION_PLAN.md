# Bonus A: reaction migration and release gate

> **HISTORICAL — phase/release record.** Scope, approvals, test counts, database revisions and pending gates below describe that release, not the finished application. See the [current README](../README.md) and [final verification](FINAL_VERIFICATION.md) for shipped features and latest results. This record is retained as evidence, not a new execution instruction.

Scope: only emoji reactions. Code is based on approved fidelity commit `727b14935d442923db2694831222567caab390f1`. The owner explicitly approved commit/push, deployment and additive production migration on 9 October 2026. Reset, reseed, billing changes and other-project modifications remain forbidden.

## Backup gate completed before local migrations

2026-10-09 **05:17:48 UTC / 10:47:48 IST**: authorized SSH connected only to the existing Signal backend in project `79d07114-2882-4fe7-8e95-48b617074324`. It checked the configured database and mounted volume, opened `/data/signal.sqlite3` read-only, used SQLite's online backup API into an ephemeral remote file (includes committed WAL data), verified integrity/FKs, transferred the snapshot off-host and removed the temporary remote directory automatically. No raw live-file copy or production SQL write was used.

Off-host snapshot: **143,360 bytes**, SHA-256 `18f68e21aeac5ba9fafb183f9895ba3fc517c49c322afc1c9e34c82479fdb405`, revision `0001`. Counts: **7 users, 5 conversations, 13 memberships, 24 messages, 31 receipts**. A separate off-host restore passed full integrity, FK, revision and count checks. The snapshot and restore contain session data: keep private, outside Git; do not attach them to the submission.

Private Windows location: `C:\Users\HarshPC\.codex\visualizations\2026\10\08\01a11b98-36ec-7431-a3fd-6f185920e179\reactions\backups\production-pre-reactions-20261009T051748Z.sqlite3`. Verification metadata and separate restore are alongside it. This is a local off-host copy, not a second cloud disaster-recovery location. Protect this folder and retain through evaluation.

## Fresh release backup

2026-10-09 **05:40:09 UTC / 11:10:09 IST**: a fresh online snapshot from the verified mounted production database passed remote integrity/FK checks, independent local SHA-256 verification and a second-file restore with every table row compared. SHA-256: `18f68e21aeac5ba9fafb183f9895ba3fc517c49c322afc1c9e34c82479fdb405`; 143,360 bytes; revision `0001`. Baseline: 7 users, 6 contacts, 5 conversations (2 groups), 13 memberships, 24 messages (IDs 1–24), 31 receipts, 26 sessions and 26 auth challenges. Group IDs: 900003, 900004.

Private snapshot and verified restore are under the same off-host evidence root in `reactions/deployment/backups/`, named `before-20261009T054009Z.sqlite3` and `before-restore-20261009T054009Z.sqlite3`. They are outside Git. Production baseline commit: `727b14935d442923db2694831222567caab390f1`.

## Additive revision 0002

1. Start a real SQLite transaction before DDL when the driver has not already started one. This handles sqlite3 legacy DDL transaction behavior.
2. Add `messages.reaction_version INTEGER NOT NULL DEFAULT 0` using ALTER ADD COLUMN. No message table rebuild, ID changes or body/receipt edits.
3. Create `message_reactions(message_id,user_id,emoji,conversation_id,created_at)` with composite primary key `(message_id,user_id,emoji)`, matching message/member composite foreign keys, six-emoji CHECK and member lookup index. Foreign keys use RESTRICT; historical membership and reactions are retained.
4. Advance Alembic to `0002` in the same transaction. Release the migration engine even on failure. No backfill, seed or deletion.

Two local rehearsals upgraded separate private copies of the verified production backup; repeat upgrades were no-ops. Fingerprints of **every old column and row in every application table**, including sessions, contacts, membership, messages and receipts, matched before/after. Integrity/FKs passed; all initial reaction versions were zero and the new table was empty. The original backup hash stayed unchanged. A failure-injection test after ALTER verified complete rollback to the old schema/revision and a successful retry without data loss.

Model rationale: the triple key allows several different emojis from one user but only one copy of each. Membership is checked inside BEGIN IMMEDIATE, serializing with removals. Mutation requests specify the desired boolean state; network retries are idempotent. A version per message handles both additions and removals, so late history/receipt responses cannot resurrect deleted reactions. Existing unread/receipt/cohort/activity behavior is retained.

## Approved production rollout

Estimate **20–30 minutes**, depending on Railway builds and smoke tests. No new dependencies, services, variables or capacity are needed.

1. Take and verify another fresh off-host online backup immediately before rollout; production users may have written since this snapshot. Record live code and database revisions. Never migrate the original backup, local developer DB or a downloaded DB into production.
2. Review the exact diff and secret/artifact exclusions, use the owner's explicit commit/push/deployment approval. Existing Git integration deploys both services on push: coordinate backend readiness before exposing the new frontend wherever the release controls permit. The existing frontend tolerates the additive response fields. A new frontend reaching an old backend reports a reaction error; it must not pretend success.
3. Keep existing `/data` mount, one backend worker/replica, variables, domains and budget. Run migration only through `python -m app.startup` **after the volume is mounted**, never build/pre-deploy. No reset or reseed. Failed migration prevents Uvicorn from starting.
4. Verify `0002`, integrity/FKs, retained message/user/group/receipt records and both health endpoints. Check HTTPS cookie attributes, exact-Origin/CSRF denials, first-frame WSS authentication and no credentials in URLs.
5. In two separate public sessions, react/toggle in direct and group chats; compare both live counts and own highlights. Check nonmember/removed-member denial without mutating existing showcase group membership unnecessarily (use a fictitious temporary QA group if needed).
6. Reload/reconnect, restart the backend and verify the same reaction/message IDs afterward. Do not delete or detach the volume. Recheck direct sending, typing, receipts, mobile layout and logs. Leave other Railway projects untouched.

## Rollback / failure recovery

Prefer application rollback with the additive schema and all reaction data retained. The old frontend can use the new backend. **Do not blindly redeploy the original 727b149 backend:** its migration directory knows only `0001`, so its startup cannot resolve a database already at `0002`. A backend rollback build must retain the `0002` migration file/revision while restoring compatible application code. No Alembic revision manipulation or downgrade is needed.

The new downgrade deliberately refuses destructive removal. Never run `downgrade base`, delete reaction tables, reset data or reseed as a rollback shortcut. On a failed migration, inspect logs/revision/integrity first; atomic failure should leave `0001` with no partial column/table. Keep the previous compatible service/version available until health succeeds.

Only if verified corruption requires restore: obtain owner approval for downtime and loss of writes since backup, stop all backend writers, preserve the current file/sidecars, restore a verified snapshot with compatible code and restart. Never replace a live SQLite file or delete its WAL/SHM while connections exist. A pre-migration restore loses later messages/reactions and is a last resort, not the default code rollback.
