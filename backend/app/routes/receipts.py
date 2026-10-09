from fastapi import APIRouter, Depends, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import Field, StrictInt
from sqlalchemy.orm import Session

from app.auth import Actor, require_csrf, require_gateway, release_identity_connection
from app.routes.conversations import Input
from app.services.receipts import acknowledge

router = APIRouter(dependencies=[Depends(require_gateway)])


class ReceiptInput(Input):
    message_ids: list[StrictInt] = Field(min_length=1, max_length=100)


async def ack(request: Request, identity, conversation_id: int, payload: ReceiptInput, read: bool):
    require_csrf(request, identity)
    release_identity_connection(identity)
    manager = request.app.state.sockets
    async with manager.mutations:
        def commit():
            with Session(request.app.state.engine) as db:
                return acknowledge(db, identity.user.id, conversation_id, payload.message_ids, read)
        messages = await run_in_threadpool(commit)
        for message in messages:
            await manager.receipt_updated(message)
    return {"messages": messages}


@router.post("/conversations/{conversation_id}/delivered")
async def delivered(conversation_id: int, payload: ReceiptInput, request: Request, identity: Actor):
    return await ack(request, identity, conversation_id, payload, False)


@router.post("/conversations/{conversation_id}/read")
async def read(conversation_id: int, payload: ReceiptInput, request: Request, identity: Actor):
    return await ack(request, identity, conversation_id, payload, True)
