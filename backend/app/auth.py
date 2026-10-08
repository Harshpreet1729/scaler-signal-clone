"""Demo auth shared identity and revocation primitives; no sockets."""
import hashlib
import secrets
import threading
import time
from collections import deque
from dataclasses import dataclass
from typing import Annotated, Iterator

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuthSession, User

DEMO_OTP = "123456"


def now_ms() -> int:
    return time.time_ns() // 1_000_000


class APIError(Exception):
    def __init__(self, status: int, code: str, message: str):
        self.status, self.code, self.message = status, code, message


class RateLimiter:
    """Bounded per-process IP window; proxied users share the gateway IP."""
    def __init__(self, limit: int):
        self.limit = limit
        self.windows: dict[str, deque[float]] = {}
        self.lock = threading.Lock()

    def check(self, key: str) -> None:
        with self.lock:
            current = time.monotonic()
            for old_key in list(self.windows):
                if not self.windows[old_key] or self.windows[old_key][-1] <= current - 60:
                    del self.windows[old_key]
            if key not in self.windows and len(self.windows) >= 1024:
                raise APIError(429, "RATE_LIMIT", "Too many attempts. Try again in a minute.")
            window = self.windows.setdefault(key, deque())
            while window and window[0] <= current - 60:
                window.popleft()
            if len(window) >= self.limit:
                raise APIError(429, "RATE_LIMIT", "Too many attempts. Try again in a minute.")
            window.append(current)


def require_gateway(request: Request) -> None:
    key = request.app.state.settings.internal_api_key
    if len(key) < 32:
        raise APIError(503, "AUTH_UNCONFIGURED", "Authentication is not configured.")
    if not secrets.compare_digest(key, request.headers.get("x-internal-api-key", "")):
        raise APIError(403, "GATEWAY_REQUIRED", "Use the application authentication routes.")
    if request.method != "GET" and request.headers.get("origin") != request.app.state.settings.frontend_origin:
        raise APIError(403, "ORIGIN", "Request origin is not allowed.")


def database_session(request: Request) -> Iterator[Session]:
    with Session(request.app.state.engine) as session:
        yield session


Database = Annotated[Session, Depends(database_session)]


@dataclass(frozen=True)
class Identity:
    user: User
    session: AuthSession


def authenticated_identity(request: Request, db: Database, _gateway: Annotated[None, Depends(require_gateway)]) -> Identity:
    authorization = request.headers.get("authorization", "")
    if not authorization.startswith("Bearer ") or not 32 <= len(authorization[7:]) <= 128:
        raise APIError(401, "UNAUTHENTICATED", "Sign in to continue.")
    token_hash = hashlib.sha256(authorization[7:].encode()).hexdigest()
    session = db.scalar(select(AuthSession).where(AuthSession.token_hash == token_hash))
    if session is None or session.revoked_at is not None or session.expires_at <= now_ms():
        raise APIError(401, "UNAUTHENTICATED", "Your session has ended. Sign in again.")
    user = db.get(User, session.user_id)
    if user is None:
        raise APIError(401, "UNAUTHENTICATED", "Sign in to continue.")
    return Identity(user, session)


Actor = Annotated[Identity, Depends(authenticated_identity)]


def require_csrf(request: Request, identity: Identity) -> None:
    if not secrets.compare_digest(identity.session.csrf_token, request.headers.get("x-csrf-token", "")):
        raise APIError(403, "CSRF", "Refresh the page and try again.")


def revoke_session(db: Session, session_id: str) -> None:
    session = db.get(AuthSession, session_id)
    if session is not None and session.revoked_at is None:
        session.revoked_at = now_ms()


def public_user(user: User) -> dict:
    return {"id": user.id, "username": user.username, "display_name": user.display_name, "avatar_key": user.avatar_key}
