# Relational database proposal

> **HISTORICAL — original Phase 0 schema proposal.** The relational schema is implemented with SQLite, SQLAlchemy and Alembic. See [actual models](../backend/app/models.py), [migration files](../backend/alembic/versions/), the [current README](../README.md#relational-storage) and [final verification](FINAL_VERIFICATION.md). The original approval wording below is preserved as planning history.

Current schema: revision `0001` created the eight base tables below; additive revision `0002` adds `messages.reaction_version` and `message_reactions`, with unique `(message_id, user_id, emoji)`, composite message/member foreign keys, an emoji allowlist and a member lookup index. Groups, receipts, profiles and reactions persist on Railway's `/data` volume. Full-history access for active group members and fixed send-time receipt cohorts were approved and implemented. See [reaction migration and safe rollback](REACTIONS_MIGRATION_PLAN.md).

## Original proposal (historical)

Original Phase 0 status: design only, awaiting approval. SQLite + SQLAlchemy + Alembic. All times are server-generated UTC epoch milliseconds; identifiers are integer primary keys unless noted. Enable foreign keys on every connection. No account/message hard-deletion feature is planned; preserve referenced records.

## Tables and reasons

| Table | Important columns and constraints | Why it exists |
|---|---|---|
| `users` | `id` PK; `username` NOT NULL UNIQUE after ASCII lowercase normalization; `display_name` NOT NULL; `avatar_key` NOT NULL from allowlist; `created_at` | Stable identity/profile independent of contacts or sessions. No password or cryptographic keys for mock OTP scope. |
| `auth_challenges` | random `id` PK; normalized `username`; `purpose` CHECK register/login; `expires_at`; `attempts` CHECK 0..5; nullable `consumed_at` | Enforce expiry, attempt count, one-time verification; username may not yet exist. OTP value comes from demo config. |
| `sessions` | `id` PK; `user_id` FK users; `token_hash` UNIQUE NOT NULL; random `csrf_token`; `created_at`; `expires_at`; nullable `revoked_at` | Persist login and enforce server-side revocation after restart. Raw session credentials are not stored. CSRF token is returned by authenticated `/auth/me`, remains stable across tabs, and cannot authenticate by itself. |
| `contacts` | composite PK (`owner_id`, `contact_user_id`), both FKs users; `created_at`; CHECK owner != contact | A directional personal address book. Adding Bob to Alice's contacts does not edit Bob's list or grant chat access. |
| `conversations` | `id` PK; `kind` CHECK direct/group; nullable `name`, `direct_low_user_id`, `direct_high_user_id`; `created_by` FK users; `created_at`, `last_activity_at`; `version` default 1; UNIQUE (`direct_low_user_id`, `direct_high_user_id`) | Shared chat metadata, activity ordering, and canonical direct identity. Both pair columns are FKs users. |
| `conversation_members` | composite PK (`conversation_id`, `user_id`), FKs conversations/users; `role` CHECK admin/member; `joined_at`; nullable `removed_at` | Many-to-many access control and durable group role/removal state. Retain inactive rows for message/receipt references. |
| `messages` | `id` INTEGER PRIMARY KEY AUTOINCREMENT; `conversation_id`; `sender_id`; `client_message_id` UUID text; `body` NOT NULL, length 1..4000; `created_at`; UNIQUE (`sender_id`, `client_message_id`); UNIQUE (`conversation_id`, `id`); composite FK (`conversation_id`, `sender_id`) -> members | Durable text history, unambiguous server order, and idempotent retry reconciliation. Trim/blank validation in service. |
| `message_receipts` | composite PK (`message_id`, `recipient_id`); `conversation_id`; nullable `delivered_at`, `read_at`; composite FKs (`conversation_id`, `message_id`) -> messages and (`conversation_id`, `recipient_id`) -> members; CHECK read is NULL or delivered is non-NULL and read >= delivered | Snapshot each intended recipient at send time, persistent delivery/read state, and unread counting. Avoid a redundant mutable unread counter. |

Conversation CHECK: a direct row has both pair IDs, low < high, and NULL name; a group row has both pair IDs NULL and a nonblank name of at most 100 characters. SQLite's unique pair allows multiple group rows with NULL pairs. User/conversation/message/session FKs use RESTRICT for deletion in this scope; contact rows may be removed independently in a future feature.

Cross-row rules enforced by the shared transactional service and tested: exactly two active direct members matching the canonical pair; direct roles are `member`; at least one active admin per group; sender active at send; recipient != sender and active at send; timestamps cannot precede the message. A FK proves a membership row exists, not that the member is currently active. REST and WS must use the same active-membership check.

No separate online-status table: presence is mocked. No persisted typing table: typing is ephemeral. No separate read-cursor table: receipt rows already answer unread/read queries and avoid marking unfetched history read. No event-log or attachment/reaction/reply tables in mandatory scope. Alembic maintains its own revision table.

## Indexes and query use

| Index (beyond PK/UNIQUE indexes above) | Use |
|---|---|
| `sessions(user_id, revoked_at)` and `sessions(expires_at)` | Session cleanup/revocation; token lookup uses unique hash. |
| `auth_challenges(expires_at)` | Purge expired challenges. |
| `contacts(contact_user_id)` | Reverse FK lookup and integrity maintenance. |
| `conversation_members(user_id, removed_at, conversation_id)` | Restrict conversation list to current user's active memberships. |
| `conversation_members(conversation_id, removed_at, role)` | Active recipient/admin lookup. |
| `conversations(last_activity_at DESC, id DESC)` | Stable recent-activity ordering; membership filter applies before exposing rows. |
| `messages(conversation_id, id DESC)` | Latest-message preview and keyset history/catch-up. |
| `message_receipts(recipient_id, conversation_id, message_id) WHERE read_at IS NULL` | Unread count for eligible incoming messages. |

Contact/conversation names use bounded parameterized case-insensitive queries. At demo scale, substring matching may scan the authorized result set; do not claim a normal B-tree accelerates `%query%`. No FTS until justified. Inspect real query plans before adding more indexes. Message IDs tie-break timestamp collisions; sort activity by `(last_activity_at DESC, conversation_id DESC)`.

## Transactions and invariants

**Prevent duplicate direct threads:** normalize `(actor, target)` to `(min_id, max_id)`, reject self-chat. In a short write transaction insert the canonical conversation and its two memberships. Concurrent callers race against the UNIQUE pair constraint: the loser rolls back, reselects the existing row, verifies membership, and returns it. A check-then-insert without the unique constraint is insufficient. Pair IDs are immutable; direct member operations are rejected.

**Send:** check active sender inside the write transaction; resolve duplicate sender/client UUID first, rejecting different payload/conversation. Insert message and receipt rows for all other active members, update activity and conversation version, commit, then acknowledge/publish. Rollback leaves no preview, receipt, or sent confirmation. Repeating a successful request returns the existing message and does not update activity or receipts again.

**Acknowledge:** validate that every requested ID belongs to the specified conversation and has an eligible own receipt, then monotonically update the batch atomically. Reject malformed/cross-chat batches rather than partially accepting them. Delivery time is first valid delivery acknowledgment; read time is first valid read acknowledgment. Read also sets delivery when missing. Sender cannot mark another user's messages read on that user's behalf. Update version when state changes. Unread is count of own NULL-read receipt rows in active conversations; own messages have no own receipt.

**Membership:** group creation inserts creator/admin and members atomically. Add/reactivate and remove happen under the same per-conversation serialization as send. Removal sets `removed_at`, denies all subsequent history/events/actions, and purges pending outgoing content for that user. Disallow final-admin removal; no admin-promotion UI is required initially. Membership changes update activity/version and emit invalidation; typing and receipts do not bump recent-activity time.

**History policy requiring approval:** active group members may view the entire group history, including history predating their join. Newly added users get no historical receipt rows/unread backlog. Removed users lose server access to all history; they may retain what was already displayed. Rejoining restores full history and existing personal receipt state. This simple policy must be stated in README; it is not specified by the PDF and is not claimed to match Signal's cryptographic history behavior.

**Groups and receipts:** the original send-time recipient set stays fixed even after membership changes. Former members' acknowledgment state is retained; lack of acknowledgment may keep an old aggregate status incomplete. Membership changes never invent read/delivery events.

## Migrations, seed, and durability

Phase 2 creates the initial migration. Run Alembic against a temporary empty file and verify constraints/foreign keys; subsequent migrations use SQLite-compatible table rebuilds when needed. Before any deployed migration, take a restorable backup. Do not use ORM `create_all` as a migration strategy or auto-reset production data.

Seed by stable usernames, canonical pairs, a reserved group primary key defined by the fixture, and stable message UUIDs. Detect and reject a reserved-ID collision with unrelated data; never overwrite it. First seed is transactional; a second seed must preserve counts and subsequent user edits. Use a deterministic test clock for automated assertions and relative timestamps on initial demo seeding. Tests use separate DB files and never the developer/demo volume.

Test parallel pair creation, duplicate UUID sends, concurrent send/removal, malformed receipts, final-admin removal, constraints, and restart persistence. Operational settings and backups are in [architecture](ARCHITECTURE.md); executable tests are deferred to approved implementation phases.
