"""Small, serialized SQLite operations shared by REST and WebSocket sends."""

from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.auth import APIError, now_ms, public_user
from app.models import Contact, Conversation, ConversationMember, Message, MessageReceipt, User


def active_conversation(db: Session, conversation_id: int, user_id: int) -> Conversation:
    conversation = db.get(Conversation, conversation_id)
    member = db.get(ConversationMember, (conversation_id, user_id))
    if conversation is None or member is None or member.removed_at is not None:
        raise APIError(404, "CONVERSATION_NOT_FOUND", "Conversation not found.")
    return conversation


def members(db: Session, conversation_id: int) -> list[dict]:
    rows = db.execute(select(User, ConversationMember.role).join(
        ConversationMember, ConversationMember.user_id == User.id,
    ).where(ConversationMember.conversation_id == conversation_id, ConversationMember.removed_at.is_(None)).order_by(User.id)).all()
    return [{**public_user(user), "role": role} for user, role in rows]


def message_status(db: Session, message: Message) -> str:
    receipts = list(db.scalars(select(MessageReceipt).where(MessageReceipt.message_id == message.id)))
    if receipts and all(receipt.read_at is not None for receipt in receipts):
        return "read"
    if receipts and all(receipt.delivered_at is not None for receipt in receipts):
        return "delivered"
    return "sent"


def public_message(db: Session, message: Message) -> dict:
    return {"id": message.id, "conversation_id": message.conversation_id, "sender_id": message.sender_id,
            "client_message_id": message.client_message_id, "body": message.body,
            "created_at": message.created_at, "status": message_status(db, message)}


def public_conversation(db: Session, conversation: Conversation, user_id: int) -> dict:
    people = members(db, conversation.id)
    peer = next((person for person in people if person["id"] != user_id), None)
    latest = db.scalar(select(Message).where(Message.conversation_id == conversation.id).order_by(Message.id.desc()).limit(1))
    unread = db.scalar(select(func.count()).select_from(MessageReceipt).where(
        MessageReceipt.conversation_id == conversation.id, MessageReceipt.recipient_id == user_id,
        MessageReceipt.read_at.is_(None))) or 0
    return {"id": conversation.id, "kind": conversation.kind,
            "name": peer["display_name"] if conversation.kind == "direct" and peer else conversation.name,
            "avatar_key": peer["avatar_key"] if conversation.kind == "direct" and peer else "group",
            "members": people, "last_activity_at": conversation.last_activity_at,
            "version": conversation.version, "preview": public_message(db, latest) if latest else None,
            "unread_count": unread}


def create_contact(db: Session, owner_id: int, target_id: int) -> tuple[dict, bool]:
    db.execute(text("BEGIN IMMEDIATE"))
    if owner_id == target_id:
        raise APIError(422, "SELF_CONTACT", "You cannot add yourself as a contact.")
    target = db.get(User, target_id)
    if target is None:
        raise APIError(404, "USER_NOT_FOUND", "User not found.")
    existing = db.get(Contact, (owner_id, target_id))
    created = existing is None
    if created:
        db.add(Contact(owner_id=owner_id, contact_user_id=target_id, created_at=now_ms()))
    db.commit()
    return public_user(target), created


def create_direct(db: Session, owner_id: int, target_id: int) -> tuple[dict, bool]:
    db.execute(text("BEGIN IMMEDIATE"))
    if owner_id == target_id:
        raise APIError(422, "SELF_CONVERSATION", "Choose another user.")
    if db.get(User, target_id) is None:
        raise APIError(404, "USER_NOT_FOUND", "User not found.")
    low, high = sorted((owner_id, target_id))
    conversation = db.scalar(select(Conversation).where(
        Conversation.direct_low_user_id == low, Conversation.direct_high_user_id == high))
    created = conversation is None
    if created:
        current = now_ms()
        conversation = Conversation(kind="direct", name=None, direct_low_user_id=low,
                                    direct_high_user_id=high, created_by=owner_id, created_at=current,
                                    last_activity_at=current, version=1)
        db.add(conversation)
        db.flush()
        db.add_all(ConversationMember(conversation_id=conversation.id, user_id=user_id,
                                      role="member", joined_at=current) for user_id in (low, high))
        db.flush()
    result = public_conversation(db, conversation, owner_id)
    db.commit()
    return result, created


def send_direct(db: Session, sender_id: int, conversation_id: int, client_message_id: str, body: str) -> tuple[dict, bool, list[int]]:
    if not body.strip() or len(body) > 4000:
        raise APIError(422, "MESSAGE_BODY", "Enter 1–4000 nonblank characters.")
    try:
        if str(UUID(client_message_id)) != client_message_id:
            raise ValueError
    except (ValueError, AttributeError):
        raise APIError(422, "MESSAGE_ID", "Use a lowercase UUID for the message ID.") from None
    db.execute(text("BEGIN IMMEDIATE"))
    conversation = active_conversation(db, conversation_id, sender_id)
    if conversation.kind != "direct":
        raise APIError(403, "GROUP_SEND_DEFERRED", "Group sending is available in Phase 5.")
    existing = db.scalar(select(Message).where(Message.sender_id == sender_id,
                                               Message.client_message_id == client_message_id))
    if existing:
        if existing.conversation_id != conversation_id or existing.body != body:
            raise APIError(409, "MESSAGE_ID_CONFLICT", "This message ID was already used for different content.")
        result = public_message(db, existing)
        db.rollback()
        return result, False, [conversation.direct_low_user_id, conversation.direct_high_user_id]
    current = now_ms()
    message = Message(conversation_id=conversation_id, sender_id=sender_id,
                      client_message_id=client_message_id, body=body, created_at=current)
    db.add(message)
    db.flush()
    recipient = conversation.direct_high_user_id if sender_id == conversation.direct_low_user_id else conversation.direct_low_user_id
    db.add(MessageReceipt(message_id=message.id, recipient_id=recipient, conversation_id=conversation_id))
    conversation.last_activity_at = max(current, conversation.last_activity_at + 1)
    conversation.version += 1
    db.flush()
    result = public_message(db, message)
    db.commit()
    return result, True, [sender_id, recipient]
