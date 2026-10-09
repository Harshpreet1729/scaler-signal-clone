"""Single-worker, in-process socket registry and short-lived one-use tickets."""

import asyncio
import secrets
import threading
import time
from dataclasses import dataclass, field

from fastapi import WebSocket
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.auth import APIError, now_ms
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
            await asyncio.wait_for(self.socket.send_json(frame), timeout=2)


class SocketManager:
    def __init__(self, engine) -> None:
        self.engine = engine
        self._connections: set[Connection] = set()
        self.mutations = asyncio.Lock()
        self.typing: dict[tuple[Connection, int], float] = {}

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

    async def is_active(self, connection: Connection, conversation_id: int | None = None) -> bool:
        return await run_in_threadpool(self.active, connection, conversation_id)

    async def publish(self, message: dict, participants: list[int]) -> None:
        conversation_id = message["conversation_id"]
        def get_version():
            with Session(self.engine) as db:
                return db.get(Conversation, conversation_id).version
        version = await run_in_threadpool(get_version)
        for connection in list(self._connections):
            if connection.user_id not in participants or not await self.is_active(connection, conversation_id):
                continue
            try:
                await connection.send({"v": 1, "type": "message.created", "conversation_id": conversation_id, "payload": {"message": message}})
                await connection.send({"v": 1, "type": "conversation.updated", "conversation_id": conversation_id, "payload": {"version": version}})
            except Exception:
                self.discard(connection)

    async def conversation_updated(self, conversation_id: int, participants: list[int], version: int) -> None:
        for connection in list(self._connections):
            if connection.user_id not in participants or not await self.is_active(connection, conversation_id):
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

    async def membership_removed(self, conversation_id: int, user_id: int) -> None:
        had_typing = any(key[0].user_id == user_id and key[1] == conversation_id for key in self.typing)
        self.typing = {key: expiry for key, expiry in self.typing.items()
                       if not (key[0].user_id == user_id and key[1] == conversation_id)}
        if had_typing:
            await self.publish_typing(conversation_id)
        for connection in list(self._connections):
            if connection.user_id == user_id and await self.is_active(connection):
                try:
                    await connection.send({"v": 1, "type": "membership.removed", "conversation_id": conversation_id})
                except Exception:
                    self.discard(connection)

    async def receipt_updated(self, message: dict) -> None:
        for connection in list(self._connections):
            if await self.is_active(connection, message["conversation_id"]):
                try:
                    await connection.send({"v": 1, "type": "receipt.updated", "conversation_id": message["conversation_id"],
                                           "payload": {"message": message}})
                except Exception:
                    self.discard(connection)

    async def set_typing(self, connection: Connection, conversation_id: int, typing: bool) -> None:
        # Caller holds mutations, including through fanout, just like sends/removal.
        if not await self.is_active(connection, conversation_id):
            raise APIError(404, "CONVERSATION_NOT_FOUND", "Conversation not found.")
        key = (connection, conversation_id)
        current = time.monotonic()
        if typing:
            if self.typing.get(key, 0) > current + 3:
                return  # Coalesce repeats within two seconds, even for a noisy client.
            self.typing[key] = current + 5
        else:
            if key not in self.typing:
                return
            self.typing.pop(key)
        await self.publish_typing(conversation_id)

    async def reaction_updated(self, message: dict) -> None:
        for connection in list(self._connections):
            if await self.is_active(connection, message["conversation_id"]):
                try:
                    await connection.send({"v": 1, "type": "reaction.updated", "conversation_id": message["conversation_id"],
                                           "payload": {"message": message}})
                except Exception:
                    self.discard(connection)

    async def publish_typing(self, conversation_id: int) -> None:
        current = time.monotonic()
        user_ids = sorted({connection.user_id for (connection, cid), expiry in self.typing.items()
                           if cid == conversation_id and expiry > current and await self.is_active(connection, cid)})
        for connection in list(self._connections):
            if await self.is_active(connection, conversation_id):
                try:
                    await connection.send({"v": 1, "type": "typing.changed", "conversation_id": conversation_id,
                                           "payload": {"user_ids": user_ids, "expires_in_ms": 5000}})
                except Exception:
                    self.discard(connection)

    async def disconnected(self, connection: Connection) -> None:
        async with self.mutations:
            self.discard(connection)
            conversations = {cid for conn, cid in self.typing if conn is connection}
            self.typing = {key: value for key, value in self.typing.items() if key[0] is not connection}
            for cid in conversations:
                await self.publish_typing(cid)

    async def expire_typing(self) -> None:
        async with self.mutations:
            current = time.monotonic()
            expired = [key for key, expiry in self.typing.items()
                       if expiry <= current or key[0] not in self._connections or not await self.is_active(*key)]
            for key in expired:
                self.typing.pop(key, None)
            for cid in {key[1] for key in expired}:
                await self.publish_typing(cid)

    async def typing_loop(self) -> None:
        while True:
            await asyncio.sleep(0.5)
            await self.expire_typing()
