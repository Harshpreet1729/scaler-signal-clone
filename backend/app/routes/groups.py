from fastapi import APIRouter, Depends, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import Field, StrictInt
from sqlalchemy.orm import Session

from app.auth import Actor, Database, require_csrf, require_gateway, release_identity_connection
from app.routes.conversations import Input
from app.services.direct import active_conversation, members
from app.services.groups import change_group, create_group

router = APIRouter(dependencies=[Depends(require_gateway)])


class NameInput(Input):
    name: str = Field(min_length=1, max_length=100)


class MembersInput(Input):
    user_ids: list[StrictInt] = Field(min_length=1, max_length=100)


class GroupInput(NameInput, MembersInput):
    pass


async def mutate(request: Request, identity, operation, conversation_id=None, removed=None):
    require_csrf(request, identity)
    release_identity_connection(identity)
    manager = request.app.state.sockets
    # Hold through publication: removal cannot overtake an already-authorized send.
    async with manager.mutations:
        def commit():
            with Session(request.app.state.engine) as db:
                return operation(db)
        value = await run_in_threadpool(commit)
        if removed is not None:
            await manager.membership_removed(conversation_id, removed)
        await manager.conversation_updated(value["id"], [person["id"] for person in value["members"]], value["version"])
    return {"conversation": value}


@router.post("/conversations/groups", status_code=201)
async def create(payload: GroupInput, request: Request, identity: Actor):
    return await mutate(request, identity, lambda db: create_group(db, identity.user.id, payload.name, payload.user_ids))


@router.patch("/conversations/{conversation_id}")
async def rename(conversation_id: int, payload: NameInput, request: Request, identity: Actor):
    return await mutate(request, identity, lambda db: change_group(db, identity.user.id, conversation_id, name=payload.name))


@router.get("/conversations/{conversation_id}/members")
def get_members(conversation_id: int, identity: Actor, db: Database):
    active_conversation(db, conversation_id, identity.user.id)
    return {"members": members(db, conversation_id)}


@router.post("/conversations/{conversation_id}/members")
async def add(conversation_id: int, payload: MembersInput, request: Request, identity: Actor):
    return await mutate(request, identity, lambda db: change_group(db, identity.user.id, conversation_id, add=payload.user_ids))


@router.delete("/conversations/{conversation_id}/members/{user_id}")
async def remove(conversation_id: int, user_id: int, request: Request, identity: Actor):
    return await mutate(request, identity, lambda db: change_group(db, identity.user.id, conversation_id, remove=user_id), conversation_id, user_id)
