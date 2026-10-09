"""Origin-checked first-frame WebSocket authentication and direct sends."""

import asyncio
import json

from fastapi import APIRouter, Depends, Request, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.auth import APIError, Actor, require_csrf, require_gateway
from app.models import AuthSession
from app.realtime import Connection
from app.services.direct import send_direct

router = APIRouter()
MAX_FRAME = 65536


@router.post("/auth/ws-ticket", dependencies=[Depends(require_gateway)])
def ws_ticket(request: Request, identity: Actor) -> dict:
    require_csrf(request, identity)
    ticket = request.app.state.tickets.issue(identity.session.id, request.app.state.settings.frontend_origin)
    return {"ticket": ticket, "expires_in": 30}


@router.websocket("/ws")
async def ws_endpoint(socket: WebSocket) -> None:
    app = socket.app
    origin = socket.headers.get("origin", "")
    if origin != app.state.settings.frontend_origin:
        await socket.close(code=4403)
        return
    await socket.accept()
    connection = None
    try:
        raw = await asyncio.wait_for(socket.receive_text(), timeout=5)
        if len(raw.encode("utf-8")) > MAX_FRAME:
            await socket.close(code=1009)
            return
        first = json.loads(raw)
        if not isinstance(first, dict) or first.get("v") != 1 or first.get("type") != "auth":
            await socket.close(code=4401)
            return
        payload = first.get("payload")
        ticket = payload.get("ticket") if isinstance(payload, dict) else None
        if not isinstance(ticket, str) or len(ticket) != 43:
            await socket.close(code=4401)
            return
        session_id = app.state.tickets.consume(ticket, origin)
        if session_id is None:
            await socket.close(code=4401)
            return
        def session_user():
            with Session(app.state.engine) as db:
                session = db.get(AuthSession, session_id)
                return session.user_id if session else None
        user_id = await run_in_threadpool(session_user)
        if user_id is None:
            await socket.close(code=4401)
            return
        connection = Connection(socket, user_id, session_id)
        if not await app.state.sockets.is_active(connection):
            await socket.close(code=4401)
            return
        app.state.sockets.add(connection)
        await connection.send({"v": 1, "type": "ready", "payload": {"user_id": user_id}})
        while True:
            try:
                raw = await asyncio.wait_for(socket.receive_text(), timeout=25)
            except TimeoutError:
                if not await app.state.sockets.is_active(connection):
                    await socket.close(code=4401)
                    break
                await connection.send({"v": 1, "type": "ping"})
                continue
            if len(raw.encode("utf-8")) > MAX_FRAME:
                await socket.close(code=1009)
                break
            if not await app.state.sockets.is_active(connection):
                await socket.close(code=4401)
                break
            try:
                frame = json.loads(raw)
                if not isinstance(frame, dict) or frame.get("v") != 1:
                    raise APIError(422, "FRAME", "Use protocol version 1.")
                request_id = frame.get("request_id")
                if request_id is not None and (not isinstance(request_id, str) or len(request_id) > 64):
                    raise APIError(422, "REQUEST_ID", "Invalid request ID.")
                kind = frame.get("type")
                if kind == "ping":
                    await connection.send({"v": 1, "type": "pong", "request_id": request_id})
                elif kind == "pong":
                    continue
                elif kind == "typing.set":
                    conversation_id, data = frame.get("conversation_id"), frame.get("payload")
                    if type(conversation_id) is not int or conversation_id < 1 or not isinstance(data, dict) or type(data.get("typing")) is not bool:
                        raise APIError(422, "FRAME", "Invalid typing frame.")
                    async with app.state.sockets.mutations:
                        await app.state.sockets.set_typing(connection, conversation_id, data["typing"])
                elif kind == "message.send":
                    conversation_id = frame.get("conversation_id")
                    data = frame.get("payload")
                    if not isinstance(conversation_id, int) or isinstance(conversation_id, bool) or conversation_id < 1 or not isinstance(data, dict):
                        raise APIError(422, "FRAME", "Invalid message frame.")
                    client_id, body = data.get("client_message_id"), data.get("body")
                    if not isinstance(client_id, str) or not isinstance(body, str):
                        raise APIError(422, "FRAME", "Invalid message frame.")

                    def commit():
                        with Session(app.state.engine) as db:
                            return send_direct(db, user_id, conversation_id, client_id, body)

                    async with app.state.sockets.mutations:
                        message, created, recipients = await run_in_threadpool(commit)
                        if created:
                            await app.state.sockets.publish(message, recipients)
                    await connection.send({"v": 1, "type": "message.accepted", "request_id": request_id,
                                           "conversation_id": conversation_id, "payload": {"message": message, "created": created}})
                else:
                    raise APIError(422, "EVENT", "Unsupported event type.")
            except (ValueError, TypeError):
                await connection.send({"v": 1, "type": "error", "request_id": None, "payload": {"code": "FRAME", "detail": "Invalid JSON frame."}})
            except APIError as error:
                await connection.send({"v": 1, "type": "error", "request_id": frame.get("request_id") if isinstance(frame, dict) and isinstance(frame.get("request_id"), str) else None,
                                       "payload": {"code": error.code, "detail": error.message}})
    except (WebSocketDisconnect, TimeoutError):
        if connection is None:
            try:
                await socket.close(code=4401)
            except RuntimeError:
                pass
    except (ValueError, TypeError):
        if connection is None:
            try:
                await socket.close(code=4401)
            except RuntimeError:
                pass
    finally:
        if connection:
            await app.state.sockets.disconnected(connection)
