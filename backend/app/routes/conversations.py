"""Authenticated directory, contacts, conversation reads and direct sends."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.auth import APIError, Actor, Database, public_user, require_csrf, require_gateway
from app.models import Contact, Conversation, ConversationMember, Message, User
from app.services.direct import active_conversation, create_contact, create_direct, public_conversation, public_message, send_direct

router = APIRouter(dependencies=[Depends(require_gateway)])


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class TargetInput(Input):
    user_id: int = Field(gt=0)


class SendInput(Input):
    client_message_id: str = Field(min_length=36, max_length=36)
    body: str = Field(min_length=1, max_length=4000)


@router.get("/users")
def users(identity: Actor, db: Database, query: Annotated[str, Query(max_length=64)] = "") -> dict:
    term = query.strip()
    if not term:
        return {"users": []}
    rows = db.scalars(select(User).where(User.id != identity.user.id,
        or_(func.lower(User.username).contains(term.lower(), autoescape=True),
            func.lower(User.display_name).contains(term.lower(), autoescape=True)))
        .order_by(User.display_name, User.id).limit(20)).all()
    return {"users": [public_user(user) for user in rows]}


@router.get("/contacts")
def contacts(identity: Actor, db: Database) -> dict:
    rows = db.scalars(select(User).join(Contact, Contact.contact_user_id == User.id)
                      .where(Contact.owner_id == identity.user.id).order_by(User.display_name, User.id).limit(100)).all()
    return {"contacts": [public_user(user) for user in rows]}


@router.post("/contacts")
def add_contact(payload: TargetInput, request: Request, response: Response, identity: Actor) -> dict:
    require_csrf(request, identity)
    with Session(request.app.state.engine) as db:
        user, created = create_contact(db, identity.user.id, payload.user_id)
    response.status_code = 201 if created else 200
    return {"contact": user, "created": created}


@router.get("/conversations")
def conversations(identity: Actor, db: Database, query: Annotated[str, Query(max_length=64)] = "",
                  filter: Annotated[str, Query(pattern="^(all|unread)$")] = "all",
                  cursor: Annotated[str | None, Query(max_length=40)] = None) -> dict:
    statement = select(Conversation).join(ConversationMember).where(
        ConversationMember.user_id == identity.user.id, ConversationMember.removed_at.is_(None))
    if cursor:
        try:
            activity, last_id = map(int, cursor.split(":"))
            if activity < 0 or last_id < 1:
                raise ValueError
        except ValueError:
            raise APIError(422, "CURSOR", "Invalid conversation cursor.") from None
        statement = statement.where(or_(Conversation.last_activity_at < activity,
            (Conversation.last_activity_at == activity) & (Conversation.id < last_id)))
    rows = db.scalars(statement.order_by(Conversation.last_activity_at.desc(), Conversation.id.desc())).all()
    term = query.strip().lower()
    selected = []
    for row in rows:
        value = public_conversation(db, row, identity.user.id)
        if filter == "unread" and not value["unread_count"]:
            continue
        if term and term not in value["name"].lower() and not any(
            term in person["username"].lower() or term in person["display_name"].lower()
            for person in value["members"] if person["id"] != identity.user.id):
            continue
        selected.append(value)
        if len(selected) >= 51:
            break
    next_cursor = None
    if len(selected) > 50:
        selected = selected[:50]
        last = selected[-1]
        next_cursor = f'{last["last_activity_at"]}:{last["id"]}'
    return {"conversations": selected, "next_cursor": next_cursor}


@router.post("/conversations/direct")
async def direct(payload: TargetInput, request: Request, response: Response, identity: Actor) -> dict:
    require_csrf(request, identity)
    def commit() -> tuple[dict, bool]:
        with Session(request.app.state.engine) as db:
            return create_direct(db, identity.user.id, payload.user_id)
    conversation, created = await run_in_threadpool(commit)
    if created:
        await request.app.state.sockets.conversation_updated(conversation["id"],
            [identity.user.id, payload.user_id], conversation["version"])
    response.status_code = 201 if created else 200
    return {"conversation": conversation, "created": created}


@router.get("/conversations/{conversation_id}")
def detail(conversation_id: int, identity: Actor, db: Database) -> dict:
    row = active_conversation(db, conversation_id, identity.user.id)
    return {"conversation": public_conversation(db, row, identity.user.id)}


@router.get("/conversations/{conversation_id}/messages")
def history(conversation_id: int, identity: Actor, db: Database,
            before_id: Annotated[int | None, Query(gt=0)] = None,
            after_id: Annotated[int | None, Query(gt=0)] = None,
            limit: Annotated[int, Query(ge=1, le=100)] = 50) -> dict:
    active_conversation(db, conversation_id, identity.user.id)
    if before_id and after_id:
        raise APIError(422, "PAGINATION", "Choose before_id or after_id.")
    statement = select(Message).where(Message.conversation_id == conversation_id)
    if before_id:
        statement = statement.where(Message.id < before_id)
    if after_id:
        statement = statement.where(Message.id > after_id)
    descending = not after_id
    rows = db.scalars(statement.order_by(Message.id.desc() if descending else Message.id.asc()).limit(limit + 1)).all()
    has_more = len(rows) > limit
    rows = rows[:limit]
    if descending:
        rows.reverse()
    return {"messages": [public_message(db, row) for row in rows],
            "next_before_id": rows[0].id if has_more and descending and rows else None,
            "has_more": has_more}


@router.post("/conversations/{conversation_id}/messages")
async def send(conversation_id: int, payload: SendInput, request: Request, response: Response, identity: Actor) -> dict:
    require_csrf(request, identity)

    def commit() -> tuple[dict, bool, list[int]]:
        with Session(request.app.state.engine) as db:
            return send_direct(db, identity.user.id, conversation_id, payload.client_message_id, payload.body)

    message, created, recipients = await run_in_threadpool(commit)
    if created:
        await request.app.state.sockets.publish(message, recipients)
    response.status_code = 201 if created else 200
    return {"message": message, "created": created}
