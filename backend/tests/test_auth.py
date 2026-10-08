import hashlib
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import now_ms
from app.main import create_app
from app.models import AuthChallenge, AuthSession, User
from app.seed import seed_database
from conftest import ORIGIN, TEST_KEY


def new_challenge(client, username="tester", purpose="register"):
    response = client.post("/v1/auth/challenges", json={"username": username, "purpose": purpose})
    assert response.status_code == 201, response.text
    return response.json()["challenge_id"]


def registration(challenge_id, **changes):
    return {"challenge_id": challenge_id, "otp": "123456", "display_name": "Test Person", "avatar_key": "sky", **changes}


def register(client, username="tester"):
    response = client.post("/v1/auth/register", json=registration(new_challenge(client, username)))
    assert response.status_code == 201, response.text
    return response.json()


def bearer(data):
    return {"Authorization": "Bearer " + data["session_token"]}


def test_registration_normalization_one_use_and_login_distinction(client):
    challenge_id = new_challenge(client, "TeStEr")
    assert client.post("/v1/auth/login", json={"challenge_id": challenge_id, "otp": "123456"}).status_code == 403
    response = client.post("/v1/auth/register", json=registration(challenge_id, display_name="  Test Person  "))
    assert response.status_code == 201
    assert response.json()["user"]["username"] == "tester"
    assert response.json()["user"]["display_name"] == "Test Person"
    assert client.post("/v1/auth/register", json=registration(challenge_id)).status_code == 400
    assert client.post("/v1/auth/challenges", json={"username": "TESTER", "purpose": "register"}).status_code == 409
    assert client.post("/v1/auth/challenges", json={"username": "missing", "purpose": "login"}).status_code == 404
    login_id = new_challenge(client, "tester", "login")
    assert client.post("/v1/auth/register", json=registration(login_id)).status_code == 403
    assert client.post("/v1/auth/login", json={"challenge_id": login_id, "otp": "123456"}).status_code == 200


def test_wrong_otp_attempt_limit_and_expiration(client, engine):
    challenge_id = new_challenge(client)
    for _ in range(5):
        assert client.post("/v1/auth/register", json=registration(challenge_id, otp="000000")).status_code == 401
    assert client.post("/v1/auth/register", json=registration(challenge_id)).status_code == 400
    with Session(engine) as db:
        assert db.get(AuthChallenge, challenge_id).attempts == 5
    expired = new_challenge(client, "expired_user")
    with Session(engine) as db:
        db.get(AuthChallenge, expired).expires_at = 1
        db.commit()
    assert client.post("/v1/auth/register", json=registration(expired)).status_code == 400


@pytest.mark.parametrize("username", ["ab", "a" * 33, "alice smith", "éva", "ALİCE", "<script>"])
def test_invalid_username_rejected(client, username):
    assert client.post("/v1/auth/challenges", json={"username": username, "purpose": "register"}).status_code == 422


@pytest.mark.parametrize("changes", [{"display_name": "   "}, {"display_name": "a" * 81}, {"avatar_key": "signal"}, {"otp": "12"}, {"user_id": 900002}])
def test_invalid_registration_fields_are_redacted(client, changes):
    challenge_id = new_challenge(client)
    response = client.post("/v1/auth/register", json=registration(challenge_id, **changes))
    assert response.status_code == 422
    assert set(response.json()["error"]) == {"code", "message", "fields"}
    assert "123456" not in response.text
    # Validation does not consume the valid challenge.
    assert client.post("/v1/auth/register", json=registration(challenge_id)).status_code == 201


def test_session_restart_hashes_expiry_and_logout(client, settings, engine):
    data = register(client)
    with Session(engine) as db:
        session = db.scalar(select(AuthSession))
        assert session.token_hash == hashlib.sha256(data["session_token"].encode()).hexdigest()
        assert session.token_hash != data["session_token"]
        session_id = session.id
    with TestClient(create_app(settings), headers={"X-Internal-API-Key": TEST_KEY, "Origin": ORIGIN, **bearer(data)}) as restarted:
        me = restarted.get("/v1/auth/me")
        assert me.status_code == 200
        assert set(me.json()) == {"user", "csrf_token", "expires_at"}
        assert data["session_token"] not in me.text
        assert me.headers["cache-control"] == "no-store"
        assert restarted.post("/v1/auth/logout", json={}).status_code == 403
        assert restarted.post("/v1/auth/logout", headers={"X-CSRF-Token": "wrong"}, json={}).status_code == 403
        assert restarted.post("/v1/auth/logout", headers={"X-CSRF-Token": data["csrf_token"]}, json={}).status_code == 200
        assert restarted.get("/v1/auth/me").status_code == 401
    with Session(engine) as db:
        assert db.get(AuthSession, session_id).revoked_at is not None
    login_id = new_challenge(client, "tester", "login")
    second = client.post("/v1/auth/login", json={"challenge_id": login_id, "otp": "123456"}).json()
    with Session(engine) as db:
        session = db.scalar(select(AuthSession).where(AuthSession.revoked_at.is_(None)))
        session.expires_at = now_ms() - 1
        session.created_at = session.expires_at - 1000
        db.commit()
    assert client.get("/v1/auth/me", headers=bearer(second)).status_code == 401


def test_multiple_sessions_independent_and_profile_owned(client, settings):
    first = register(client, "first_user")
    second = register(client, "second_user")
    headers = {**bearer(first), "X-CSRF-Token": first["csrf_token"]}
    assert client.patch("/v1/users/me", headers=headers, json={"display_name": "Edited Person", "avatar_key": "fern", "user_id": second["user"]["id"]}).status_code == 422
    assert client.patch("/v1/users/me", headers=bearer(first), json={"display_name": "Edited Person", "avatar_key": "fern"}).status_code == 403
    updated = client.patch("/v1/users/me", headers=headers, json={"display_name": "Edited Person", "avatar_key": "fern"})
    assert updated.status_code == 200
    assert updated.json()["user"]["id"] == first["user"]["id"]
    assert client.get("/v1/auth/me", headers=bearer(second)).json()["user"]["display_name"] == "Test Person"
    assert client.get(f"/v1/users/{second['user']['id']}", headers=bearer(first)).status_code == 404
    third = client.post("/v1/auth/login", json={"challenge_id": new_challenge(client, "first_user", "login"), "otp": "123456"}).json()
    assert client.post("/v1/auth/logout", headers=headers, json={}).status_code == 200
    assert client.get("/v1/auth/me", headers=bearer(third)).status_code == 200


def test_gateway_origin_unauthenticated_and_bounded_requests(client, settings):
    assert client.get("/v1/auth/me").status_code == 401
    assert client.get("/v1/auth/me", headers={"X-Internal-API-Key": "wrong"}).status_code == 403
    assert client.post("/v1/auth/challenges", headers={"Origin": "http://evil.example"}, json={"username": "tester", "purpose": "register"}).status_code == 403
    assert client.post("/v1/auth/challenges", content="not json", headers={"Content-Type": "application/json"}).status_code == 422
    assert client.post("/v1/auth/challenges", content="x" * 8193).status_code == 413
    assert client.get("/v1/auth/me", headers={"Authorization": "Bearer " + "x" * 43}).status_code == 401
    with TestClient(create_app(replace(settings, internal_api_key=""))) as unconfigured:
        assert unconfigured.get("/v1/health/live").status_code == 200
        assert unconfigured.get("/v1/auth/me").status_code == 503


def test_rate_limit_is_real(client, settings):
    with TestClient(create_app(replace(settings, auth_rate_limit=2)), headers={"X-Internal-API-Key": TEST_KEY, "Origin": ORIGIN}) as limited:
        assert limited.post("/v1/auth/challenges", json={"username": "first", "purpose": "register"}).status_code == 201
        assert limited.post("/v1/auth/challenges", json={"username": "second", "purpose": "register"}).status_code == 201
        assert limited.post("/v1/auth/challenges", json={"username": "third", "purpose": "register"}).status_code == 429


def test_concurrent_challenge_consumption_creates_one_user(client, engine):
    challenge_id = new_challenge(client)
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: client.post("/v1/auth/register", json=registration(challenge_id)), range(2)))
    assert sorted(response.status_code for response in responses) == [201, 400]
    with Session(engine) as db:
        assert len(db.scalars(select(User)).all()) == 1


def test_all_seed_accounts_login(client, settings):
    seed_database(settings)
    for username in ("alice", "bob", "carol", "dave"):
        response = client.post("/v1/auth/login", json={"challenge_id": new_challenge(client, username, "login"), "otp": "123456"})
        assert response.status_code == 200
        assert response.json()["user"]["username"] == username
