"""Single-worker, in-process socket registry and short-lived one-use tickets."""

import asyncio
import secrets
import threading
import time
from dataclasses import dataclass, field

from fastapi import WebSocket
from sqlalchemy.orm import Session

from app.auth import now_ms
from app.models import AuthSession, Conversation, ConversationMember


class TicketStore:
    def __init__(self) -> None:
        self._items: dict[str, tuple[str, str, float]] = {}
        self._lock = threading.Lock()

    def issue(self, session_id: str, origin: str) -> str:
        with self._lock:
            current = time.monotonic()
            self._items = {key: value for key, value in self._items.items() if value[2] > current}
            ticket = secrets.token_urlsafe(32)
            self._items[ticket] = (session_id, origin, current + 30)
            return ticket

    def consume(self, ticket: str, origin: str) -> str | None:
        with self._lock:
            item = self._items.pop(ticket, None)
        return item[0] if item and item[1] == origin and item[2] > time.monotonic() else None


@dataclass(eq=False)
class Connection:
    socket: WebSocket
    user_id: int
    session_id: str
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    async def send(self, frame: dict) -> None:
        async with self.lock:
            await self.socket.send_json(frame)


class SocketManager:
    def __init__(self, engine) -> None:
        self.engine = engine
        self._connections: set[Connection] = set()

    def add(self, connection: Connection) -> None:
        self._connections.add(connection)

    def discard(self, connection: Connection) -> None:
        self._connections.discard(connection)

    def active(self, connection: Connection, conversation_id: int | None = None) -> bool:
        with Session(self.engine) as db:
            session = db.get(AuthSession, connection.session_id)
            if not session or session.user_id != connection.user_id or session.revoked_at is not None or session.expires_at <= now_ms():
                return False
            if conversation_id is not None:
                member = db.get(ConversationMember, (conversation_id, connection.user_id))
                if not member or member.removed_at is not None:
                    return False
            return True

    async def publish(self, message: dict, participants: list[int]) -> None:
        conversation_id = message["conversation_id"]
        with Session(self.engine) as db:
            version = db.get(Conversation, conversation_id).version
        for connection in list(self._connections):
            if connection.user_id not in participants or not self.active(connection, conversation_id):
                continue
            try:
                await connection.send({"v": 1, "type": "message.created", "conversation_id": conversation_id, "payload": {"message": message}})
                await connection.send({"v": 1, "type": "conversation.updated", "conversation_id": conversation_id, "payload": {"version": version}})
            except Exception:
                self.discard(connection)

    async def conversation_updated(self, conversation_id: int, participants: list[int], version: int) -> None:
        for connection in list(self._connections):
            if connection.user_id not in participants or not self.active(connection, conversation_id):
                continue
            try:
                await connection.send({"v": 1, "type": "conversation.updated", "conversation_id": conversation_id,
                                       "payload": {"version": version}})
            except Exception:
                self.discard(connection)

    async def close_session(self, session_id: str) -> None:
        for connection in list(self._connections):
            if connection.session_id == session_id:
                self.discard(connection)
                try:
                    await connection.socket.close(code=4401)
                except Exception:
                    pass
