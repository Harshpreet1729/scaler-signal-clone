from fastapi import APIRouter, Depends, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import Field, StrictBool, StrictInt
from sqlalchemy.orm import Session

from app.auth import Actor, require_csrf, require_gateway, release_identity_connection
from app.routes.conversations import Input
from app.services.reactions import set_reaction

router = APIRouter(dependencies=[Depends(require_gateway)])


class ReactionInput(Input):
    message_id: StrictInt = Field(gt=0)
    emoji: str = Field(min_length=1, max_length=8)
    active: StrictBool


@router.post("/conversations/{conversation_id}/reactions")
async def react(conversation_id: int, payload: ReactionInput, request: Request, identity: Actor) -> dict:
    require_csrf(request, identity)
    release_identity_connection(identity)
    manager = request.app.state.sockets
    async with manager.mutations:
        def commit():
            with Session(request.app.state.engine) as db:
                return set_reaction(db, identity.user.id, conversation_id, payload.message_id, payload.emoji, payload.active)
        message, changed = await run_in_threadpool(commit)
        if changed:
            await manager.reaction_updated(message)
    return {"message": message, "changed": changed}
