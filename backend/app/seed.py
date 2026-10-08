"""Explicit, transactional fixtures. Reruns insert missing rows, never reset edits."""
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.auth import now_ms
from app.database import make_engine
from app.models import Contact, Conversation, ConversationMember, Message, MessageReceipt, User
from app.settings import Settings

FIXTURE_USERS = ((900001, "alice", "Alice Morgan", "sky"), (900002, "bob", "Bob Patel", "fern"),
                 (900003, "carol", "Carol Chen", "sun"), (900004, "dave", "Dave Rivera", "clay"))


def seed_database(settings: Settings) -> dict[str, int]:
    engine = make_engine(settings.database_path)
    inserted = {"users": 0, "contacts": 0, "conversations": 0, "members": 0, "messages": 0, "receipts": 0}
    timestamp = now_ms() - 3600000
    try:
        with Session(engine) as db:
            db.execute(text("BEGIN IMMEDIATE"))
            for user_id, username, display_name, avatar in FIXTURE_USERS:
                by_id = db.get(User, user_id)
                by_name = db.scalar(select(User).where(User.username == username))
                if (by_id is not None and by_id.username != username) or (by_name is not None and by_name.id != user_id):
                    raise ValueError(f"Reserved seed identity collision: {username}. No data changed.")
                if by_id is None:
                    db.add(User(id=user_id, username=username, display_name=display_name, avatar_key=avatar, created_at=timestamp))
                    inserted["users"] += 1
            db.flush()
            for owner, target in ((1, 2), (1, 3), (1, 4), (2, 1), (3, 1), (4, 1)):
                pair = (900000 + owner, 900000 + target)
                if db.get(Contact, pair) is None:
                    db.add(Contact(owner_id=pair[0], contact_user_id=pair[1], created_at=timestamp))
                    inserted["contacts"] += 1
            definitions = ((900001, "direct", None, 900001, 900002), (900002, "direct", None, 900001, 900003),
                           (900003, "group", "Weekend Plans", None, None))
            for conversation_id, kind, name, low, high in definitions:
                existing = db.get(Conversation, conversation_id)
                if existing is not None and (existing.kind, existing.direct_low_user_id, existing.direct_high_user_id, existing.created_by) != (kind, low, high, 900001):
                    raise ValueError("Reserved seed conversation collision. No data changed.")
                if existing is not None and kind == "group":
                    sentinel = str(uuid5(NAMESPACE_URL, "scaler-signal-demo/message/5"))
                    if db.scalar(select(Message.id).where(Message.conversation_id == conversation_id, Message.sender_id == 900001, Message.client_message_id == sentinel)) is None:
                        raise ValueError("Reserved seed group lacks its fixture identity. No data changed.")
                if existing is None:
                    if kind == "direct" and db.scalar(select(Conversation.id).where(Conversation.direct_low_user_id == low, Conversation.direct_high_user_id == high)) is not None:
                        raise ValueError("Reserved seed direct pair already exists under another identity. No data changed.")
                    db.add(Conversation(id=conversation_id, kind=kind, name=name, direct_low_user_id=low, direct_high_user_id=high,
                                        created_by=900001, created_at=timestamp, last_activity_at=timestamp + 600000, version=1))
                    inserted["conversations"] += 1
            db.flush()
            for conversation_id, members in ((900001, (900001, 900002)), (900002, (900001, 900003)), (900003, (900001, 900002, 900003))):
                for user_id in members:
                    if db.get(ConversationMember, (conversation_id, user_id)) is None:
                        db.add(ConversationMember(conversation_id=conversation_id, user_id=user_id,
                                                  role="admin" if conversation_id == 900003 and user_id == 900001 else "member", joined_at=timestamp))
                        inserted["members"] += 1
            db.flush()
            messages = ((900001, 900001, "Hi Bob, welcome to the demo.", ("read",)),
                        (900001, 900002, "Thanks Alice. See you Saturday?", ("delivered",)),
                        (900002, 900001, "Carol, do you have a picnic suggestion?", ("sent",)),
                        (900002, 900003, "The riverside park looks good.", ("read",)),
                        (900003, 900001, "Weekend Plans: picnic at noon?", ("read", "delivered")),
                        (900003, 900002, "I can bring snacks.", ("read", "read")))
            for ordinal, (conversation_id, sender_id, body, statuses) in enumerate(messages, 1):
                client_id = str(uuid5(NAMESPACE_URL, f"scaler-signal-demo/message/{ordinal}"))
                existing = db.scalar(select(Message).where(Message.client_message_id == client_id))
                if existing is not None and (existing.sender_id != sender_id or existing.conversation_id != conversation_id):
                    raise ValueError("Reserved seed message collision. No data changed.")
                if existing is None:
                    existing = Message(conversation_id=conversation_id, sender_id=sender_id, client_message_id=client_id, body=body, created_at=timestamp + ordinal * 100000)
                    db.add(existing)
                    db.flush()
                    inserted["messages"] += 1
                recipients = list(db.scalars(select(ConversationMember.user_id).where(ConversationMember.conversation_id == conversation_id, ConversationMember.user_id != sender_id).order_by(ConversationMember.user_id)))
                # Only the original fixture cohort is created; never add newly joined users on rerun.
                cohort = {900001, 900002} if conversation_id == 900001 else ({900001, 900003} if conversation_id == 900002 else {900001, 900002, 900003})
                recipients = [recipient for recipient in recipients if recipient in cohort]
                for recipient, status in zip(recipients, statuses, strict=True):
                    if db.get(MessageReceipt, (existing.id, recipient)) is None:
                        delivered = existing.created_at + 1000 if status != "sent" else None
                        db.add(MessageReceipt(message_id=existing.id, recipient_id=recipient, conversation_id=conversation_id,
                                              delivered_at=delivered, read_at=existing.created_at + 2000 if status == "read" else None))
                        inserted["receipts"] += 1
            db.commit()
    finally:
        engine.dispose()
    return inserted


if __name__ == "__main__":
    try:
        print("Seed inserted:", seed_database(Settings.from_env()))
    except ValueError as error:
        raise SystemExit(str(error)) from None
