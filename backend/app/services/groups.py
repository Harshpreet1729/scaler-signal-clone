"""Group membership changes retain historical membership and receipt rows."""
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.auth import APIError, now_ms
from app.models import Conversation, ConversationMember, User
from app.services.direct import active_conversation, members, public_conversation


def group_name(name: str) -> str:
    name = name.strip()
    if not 1 <= len(name) <= 100 or any(ord(char) < 32 for char in name):
        raise APIError(422, "GROUP_NAME", "Enter a group name of 1–100 characters without control characters.")
    return name


def create_group(db: Session, actor: int, name: str, user_ids: list[int]) -> dict:
    name = group_name(name)
    ids = set(user_ids) | {actor}
    if not 2 <= len(ids) <= 100:
        raise APIError(422, "GROUP_MEMBERS", "Choose 1–99 other members.")
    db.execute(text("BEGIN IMMEDIATE"))
    if len(db.scalars(select(User.id).where(User.id.in_(ids))).all()) != len(ids):
        raise APIError(404, "USER_NOT_FOUND", "A selected user does not exist.")
    current = now_ms()
    row = Conversation(kind="group", name=name, created_by=actor, created_at=current,
                       last_activity_at=current, version=1)
    db.add(row)
    db.flush()
    db.add_all(ConversationMember(conversation_id=row.id, user_id=user_id,
               role="admin" if user_id == actor else "member", joined_at=current) for user_id in ids)
    db.flush()
    result = public_conversation(db, row, actor)
    db.commit()
    return result


def change_group(db: Session, actor: int, conversation_id: int, *, name: str | None = None,
                 add: list[int] | None = None, remove: int | None = None) -> dict:
    db.execute(text("BEGIN IMMEDIATE"))
    row = active_conversation(db, conversation_id, actor)
    if row.kind != "group":
        raise APIError(422, "GROUP_REQUIRED", "Direct conversation membership cannot be changed.")
    if db.get(ConversationMember, (conversation_id, actor)).role != "admin":
        raise APIError(403, "ADMIN_REQUIRED", "Only a group admin can change this group.")
    current = now_ms()
    people = members(db, conversation_id)
    if name is not None:
        row.name = group_name(name)
    if add is not None:
        ids = set(add)
        if len(ids | {person["id"] for person in people}) > 100:
            raise APIError(422, "GROUP_MEMBERS", "A group can have at most 100 active members.")
        if len(db.scalars(select(User.id).where(User.id.in_(ids))).all()) != len(ids):
            raise APIError(404, "USER_NOT_FOUND", "A selected user does not exist.")
        for user_id in ids:
            member = db.get(ConversationMember, (conversation_id, user_id))
            if member is None:
                db.add(ConversationMember(conversation_id=conversation_id, user_id=user_id, role="member", joined_at=current))
            elif member.removed_at is not None:
                member.removed_at, member.joined_at, member.role = None, current, "member"
    if remove is not None:
        member = db.get(ConversationMember, (conversation_id, remove))
        if member and member.removed_at is None:
            if member.role == "admin" and sum(person["role"] == "admin" for person in people) <= 1:
                raise APIError(409, "LAST_ADMIN", "The final admin cannot be removed.")
            member.removed_at = max(current, member.joined_at)
    row.version += 1
    row.last_activity_at = max(current, row.last_activity_at + 1)
    db.flush()
    result = public_conversation(db, row, actor)
    db.commit()
    return result
