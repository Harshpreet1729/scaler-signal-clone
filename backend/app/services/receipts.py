"""Acknowledgments change only the authenticated recipient's original cohort rows."""
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.auth import APIError, now_ms
from app.models import Message, MessageReceipt
from app.services.direct import active_conversation, public_message


def acknowledge(db: Session, actor: int, conversation_id: int, message_ids: list[int], read: bool) -> list[dict]:
    if not 1 <= len(message_ids) <= 100 or any(type(value) is not int or value < 1 for value in message_ids):
        raise APIError(422, "RECEIPT_IDS", "Acknowledge 1–100 message IDs.")
    db.execute(text("BEGIN IMMEDIATE"))
    conversation = active_conversation(db, conversation_id, actor)
    ids = set(message_ids)
    rows = db.scalars(select(MessageReceipt).where(MessageReceipt.message_id.in_(ids),
        MessageReceipt.recipient_id == actor, MessageReceipt.conversation_id == conversation_id)).all()
    if len(rows) != len(ids):
        raise APIError(404, "RECEIPT_NOT_FOUND", "An eligible receipt was not found.")
    changed = []
    for row in rows:
        message = db.get(Message, row.message_id)
        current = max(now_ms(), message.created_at, row.delivered_at or 0)
        if row.delivered_at is None or (read and row.read_at is None):
            row.delivered_at = row.delivered_at or current
            if read:
                row.read_at = row.read_at or current
            changed.append(message)
    if changed:
        conversation.version += 1  # Do not reorder the conversation on receipt activity.
    db.flush()
    result = [public_message(db, message) for message in changed]
    db.commit()
    return result
