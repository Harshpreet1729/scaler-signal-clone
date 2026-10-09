from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.main import create_app
from app.models import MessageReaction
from app.seed import seed_database
from app.services.reactions import set_reaction
from app.services.groups import change_group
from app.auth import APIError
from conftest import ORIGIN, TEST_KEY
from test_direct_phase4 import login
from test_groups_phase5 import connect, drain


def send(client, headers, conversation=900001):
    return client.post(f"/v1/conversations/{conversation}/messages", headers=headers,
                       json={"body": "React here", "client_message_id": str(uuid4())}).json()["message"]


def react(client, headers, message, emoji="👍", active=True, **extra):
    return client.post(f'/v1/conversations/{message["conversation_id"]}/reactions', headers=headers,
                       json={"message_id": message["id"], "emoji": emoji, "active": active, **extra})


def test_direct_reaction_counts_own_toggle_retry_and_restart(client, settings):
    seed_database(settings)
    alice, bob = login(client, "alice"), login(client, "bob")
    message = send(client, alice)
    before = client.get("/v1/conversations/900001", headers=alice).json()
    first = react(client, alice, message).json()
    assert first["changed"] and first["message"]["reaction_version"] == 1
    assert not react(client, alice, message).json()["changed"]
    two = react(client, bob, message).json()["message"]
    assert two["reactions"] == [{"emoji": "👍", "count": 2, "user_ids": [900001, 900002]}]
    heart = react(client, alice, message, "❤️").json()["message"]
    assert len(heart["reactions"]) == 2
    assert react(client, alice, message, active=False).json()["message"]["reaction_version"] == 4
    assert not react(client, alice, message, active=False).json()["changed"]
    after = client.get("/v1/conversations/900001", headers=alice).json()
    for key in ("last_activity_at", "version", "unread_count"):
        assert before["conversation"][key] == after["conversation"][key]
    assert after["conversation"]["preview"]["status"] == message["status"]
    # Fresh app/engine/socket manager simulates backend restart over the same file.
    with TestClient(create_app(settings), headers={"X-Internal-API-Key": TEST_KEY, "Origin": ORIGIN}) as restarted:
        saved = restarted.get("/v1/conversations/900001/messages", headers=bob).json()["messages"][-1]
        assert saved["reaction_version"] == 4
        assert saved["reactions"] == [{"emoji": "❤️", "count": 1, "user_ids": [900001]}, {"emoji": "👍", "count": 1, "user_ids": [900002]}]


def test_reaction_auth_origin_csrf_message_scope_and_validation(client, settings):
    seed_database(settings)
    alice, dave = login(client, "alice"), login(client, "dave")
    message = send(client, alice)
    assert react(client, {}, message).status_code == 401
    assert react(client, {"Authorization": alice["Authorization"]}, message).status_code == 403
    assert react(client, {**alice, "Origin": "https://evil.example"}, message).status_code == 403
    assert react(client, {**alice, "X-Internal-API-Key": "wrong"}, message).status_code == 403
    assert react(client, dave, message).status_code == 404
    assert react(client, alice, {**message, "conversation_id": 900002}).status_code == 404
    assert react(client, alice, {**message, "id": 123456}).status_code == 404
    assert react(client, alice, message, user_id=900002).status_code == 422
    for emoji in ("", "❤", "<script>", "x" * 100):
        assert react(client, alice, message, emoji).status_code == 422
    assert react(client, alice, message, active=1).status_code == 422
    assert react(client, alice, {**message, "id": True}).status_code == 422
    assert client.post("/v1/auth/logout", headers=alice).status_code == 200
    assert react(client, alice, message).status_code == 401


def test_group_fanout_removal_no_leak_and_reconnect_snapshot(client, settings):
    seed_database(settings)
    identities = {name: login(client, name) for name in ("alice", "bob", "carol", "dave")}
    message = send(client, identities["alice"], 900003)
    with ExitStack() as stack:
        sockets = {name: connect(client, identity, stack) for name, identity in identities.items()}
        result = react(client, identities["bob"], message, "😂")
        assert result.status_code == 200
        for name in ("alice", "bob", "carol"):
            frame = sockets[name].receive_json()
            assert frame["type"] == "reaction.updated"
            assert frame["payload"]["message"]["reactions"][0]["user_ids"] == [900002]
        assert not drain(sockets["dave"])
        assert client.delete("/v1/conversations/900003/members/900003", headers=identities["alice"]).status_code == 200
        for socket in sockets.values():
            drain(socket)
        assert react(client, identities["carol"], message).status_code == 404
        assert react(client, identities["alice"], message, "🙏").status_code == 200
        assert not drain(sockets["carol"])
        assert not drain(sockets["dave"])
    with ExitStack() as stack:
        reconnected = connect(client, identities["bob"], stack)
        saved = client.get("/v1/conversations/900003/messages", headers=identities["bob"]).json()["messages"][-1]
        assert saved["reaction_version"] == 2 and len(saved["reactions"]) == 2
        react(client, identities["bob"], message, "😂", False)
        assert reconnected.receive_json()["payload"]["message"]["reaction_version"] == 3


def test_concurrent_sets_unique_and_database_constraints(client, settings, engine):
    seed_database(settings)
    message = send(client, login(client, "alice"))
    def set_once(_):
        with Session(engine) as db:
            return set_reaction(db, 900001, 900001, message["id"], "👍", True)[1]
    with ThreadPoolExecutor(max_workers=8) as pool:
        assert sum(pool.map(set_once, range(16))) == 1
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(MessageReaction)) == 1
    for statement in (
        "INSERT INTO message_reactions SELECT * FROM message_reactions",
        "UPDATE message_reactions SET conversation_id=900002",
        "UPDATE message_reactions SET user_id=900004",
        "UPDATE message_reactions SET emoji='bad'",
    ):
        with engine.connect() as db:
            with pytest.raises(IntegrityError):
                db.execute(text(statement))
            db.rollback()


def test_removal_and_reaction_have_transactional_order(client, settings, engine):
    seed_database(settings)
    message = send(client, login(client, "alice"), 900003)
    def reacting():
        with Session(engine) as db:
            try:
                return set_reaction(db, 900003, 900003, message["id"], "👍", True)[1]
            except APIError as error:
                assert error.status == 404
                return False
    def removing():
        with Session(engine) as db:
            change_group(db, 900001, 900003, remove=900003)
    with ThreadPoolExecutor(max_workers=2) as pool:
        reaction = pool.submit(reacting)
        pool.submit(removing).result()
        accepted = reaction.result()
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(MessageReaction)) == int(accepted)
    with Session(engine) as db:
        with pytest.raises(APIError) as denied:
            set_reaction(db, 900003, 900003, message["id"], "👍", False)
        assert denied.value.status == 404
