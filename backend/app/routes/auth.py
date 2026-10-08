import hashlib
import secrets
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import delete, select, text
from sqlalchemy.exc import IntegrityError

from app.auth import APIError, Actor, Database, DEMO_OTP, now_ms, public_user, require_csrf, require_gateway, revoke_session
from app.models import AuthChallenge, AuthSession, User

router = APIRouter(dependencies=[Depends(require_gateway)])


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_max_length=128)


class ChallengeInput(Input):
    username: str = Field(min_length=3, max_length=32)
    purpose: Literal["register", "login"]

    @field_validator("username", mode="before")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        if not isinstance(value, str) or not value.isascii():
            raise ValueError("Use an ASCII username")
        value = value.strip().lower()
        if any(character not in "abcdefghijklmnopqrstuvwxyz0123456789_" for character in value):
            raise ValueError("Use letters, numbers and underscores")
        return value


class ProfileInput(Input):
    display_name: str = Field(min_length=1, max_length=80)
    avatar_key: Literal["sky", "fern", "sun", "clay"]

    @field_validator("display_name", mode="before")
    @classmethod
    def trim_name(cls, value: str) -> str:
        if not isinstance(value, str):
            raise ValueError("Display name must be text")
        return value.strip()


class VerifyInput(Input):
    challenge_id: str = Field(min_length=20, max_length=64)
    otp: str = Field(pattern=r"^[0-9]{6}$", max_length=6)


class RegisterInput(VerifyInput, ProfileInput):
    pass


def rate_limit(request: Request) -> None:
    request.app.state.auth_limiter.check(request.client.host if request.client else "unknown")


@router.post("/auth/challenges", status_code=201)
def challenge(payload: ChallengeInput, request: Request, db: Database, _limit: Annotated[None, Depends(rate_limit)]) -> dict:
    exists = db.scalar(select(User.id).where(User.username == payload.username)) is not None
    if payload.purpose == "register" and exists:
        raise APIError(409, "USERNAME_TAKEN", "That username already exists. Use Log in.")
    if payload.purpose == "login" and not exists:
        raise APIError(404, "USER_NOT_FOUND", "That demo account does not exist. Use Register.")
    current = now_ms()
    db.execute(delete(AuthChallenge).where(AuthChallenge.expires_at < current - 86400000))
    record = AuthChallenge(id=secrets.token_urlsafe(24), username=payload.username, purpose=payload.purpose,
                           expires_at=current + request.app.state.settings.challenge_seconds * 1000, attempts=0)
    db.add(record)
    db.commit()
    return {"challenge_id": record.id, "expires_at": record.expires_at, "purpose": record.purpose}


def verify(payload: VerifyInput, purpose: str, db: Database) -> AuthChallenge:
    # Consumption and account/session creation share a serialized transaction.
    db.execute(text("BEGIN IMMEDIATE"))
    record = db.get(AuthChallenge, payload.challenge_id)
    if record is None or record.purpose != purpose:
        raise APIError(403, "CHALLENGE_PURPOSE", "Use a challenge for this operation.")
    if record.consumed_at is not None or record.expires_at <= now_ms() or record.attempts >= 5:
        raise APIError(400, "CHALLENGE_ENDED", "Request a new demo challenge.")
    record.attempts += 1
    if not secrets.compare_digest(payload.otp, DEMO_OTP):
        db.commit()
        raise APIError(401, "INVALID_OTP", "Incorrect demo OTP. Use 123456.")
    record.consumed_at = now_ms()
    return record


def start_session(user: User, request: Request, db: Database) -> dict:
    current = now_ms()
    raw_token = secrets.token_urlsafe(32)
    session = AuthSession(id=secrets.token_urlsafe(24), user_id=user.id, token_hash=hashlib.sha256(raw_token.encode()).hexdigest(),
                          csrf_token=secrets.token_urlsafe(32), created_at=current,
                          expires_at=current + request.app.state.settings.session_seconds * 1000)
    db.add(session)
    db.commit()
    # Credentials are returned only to the authenticated Next server.
    return {"user": public_user(user), "csrf_token": session.csrf_token, "expires_at": session.expires_at, "session_token": raw_token}


@router.post("/auth/register", status_code=201)
def register(payload: RegisterInput, request: Request, db: Database, _limit: Annotated[None, Depends(rate_limit)]) -> dict:
    record = verify(payload, "register", db)
    user = User(username=record.username, display_name=payload.display_name, avatar_key=payload.avatar_key, created_at=now_ms())
    db.add(user)
    try:
        db.flush()
        return start_session(user, request, db)
    except IntegrityError:
        db.rollback()
        raise APIError(409, "USERNAME_TAKEN", "That username already exists. Use Log in.") from None


@router.post("/auth/login")
def login(payload: VerifyInput, request: Request, db: Database, _limit: Annotated[None, Depends(rate_limit)]) -> dict:
    record = verify(payload, "login", db)
    user = db.scalar(select(User).where(User.username == record.username))
    if user is None:
        raise APIError(404, "USER_NOT_FOUND", "That demo account does not exist.")
    return start_session(user, request, db)


@router.get("/auth/me")
def me(identity: Actor) -> dict:
    return {"user": public_user(identity.user), "csrf_token": identity.session.csrf_token, "expires_at": identity.session.expires_at}


@router.post("/auth/logout")
async def logout(request: Request, db: Database, identity: Actor) -> dict:
    require_csrf(request, identity)
    revoke_session(db, identity.session.id)
    db.commit()
    await request.app.state.sockets.close_session(identity.session.id)
    return {"ok": True}


@router.patch("/users/me")
def update_profile(payload: ProfileInput, request: Request, db: Database, identity: Actor) -> dict:
    require_csrf(request, identity)
    identity.user.display_name, identity.user.avatar_key = payload.display_name, payload.avatar_key
    db.commit()
    return {"user": public_user(identity.user)}
