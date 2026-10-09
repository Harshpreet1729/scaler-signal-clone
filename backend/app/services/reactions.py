"""Idempotent reaction sets, serialized with membership removal and sends."""
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth import APIError, now_ms
from app.models import Message, MessageReaction
from app.services.direct import active_conversation, public_message

REACTION_EMOJIS = ("👍", "❤️", "😂", "😮", "😢", "🙏")


def set_reaction(db: Session, actor: int, conversation_id: int, message_id: int, emoji: str, active: bool) -> tuple[dict, bool]:
    if emoji not in REACTION_EMOJIS:
        raise APIError(422, "REACTION_EMOJI", "Choose an emoji from the reaction picker.")
    db.execute(text("BEGIN IMMEDIATE"))
    active_conversation(db, conversation_id, actor)
    message = db.get(Message, message_id)
    if message is None or message.conversation_id != conversation_id:
        raise APIError(404, "MESSAGE_NOT_FOUND", "Message not found.")
    existing = db.get(MessageReaction, (message_id, actor, emoji))
    changed = active != (existing is not None)
    if changed:
        if active:
            db.add(MessageReaction(message_id=message_id, user_id=actor, emoji=emoji,
                                   conversation_id=conversation_id, created_at=now_ms()))
        else:
            db.delete(existing)
        message.reaction_version += 1
        db.flush()
    result = public_message(db, message)
    db.commit()
    return result, changed
