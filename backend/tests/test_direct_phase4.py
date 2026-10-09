from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from starlette.websockets import WebSocketDisconnect

from app.main import create_app
from app.models import Conversation, ConversationMember, Message, MessageReceipt
from app.seed import seed_database
from app.services.direct import create_direct
from conftest import ORIGIN


def login(client, username):
    challenge = client.post("/v1/auth/challenges", json={"username": username, "purpose": "login"}).json()["challenge_id"]
    data = client.post("/v1/auth/login", json={"challenge_id": challenge, "otp": "123456"}).json()
    return {"Authorization": "Bearer " + data["session_token"], "X-CSRF-Token": data["csrf_token"]}


def ticket(client, headers):
    response = client.post("/v1/auth/ws-ticket", headers=headers, json={})
    assert response.status_code == 200, response.text
    return response.json()["ticket"]


def test_directory_contacts_and_member_scoped_reads(client, settings):
    seed_database(settings)
    alice, bob, dave = (login(client, name) for name in ("alice", "bob", "dave"))
    directory = client.get("/v1/users?query=bo", headers=alice).json()["users"]
    assert len(directory) == 1 and directory[0]["username"] == "bob" and set(directory[0]) == {"id", "username", "display_name", "avatar_key"}
    assert client.get("/v1/users?query=alice", headers=alice).json() == {"users": []}
    assert client.get("/v1/users?query=%25", headers=alice).json() == {"users": []}
    assert client.get("/v1/users?query=bo").status_code == 401
    assert [person["username"] for person in client.get("/v1/contacts", headers=alice).json()["contacts"]] == ["bob", "carol", "dave"]
    assert [person["username"] for person in client.get("/v1/contacts", headers=bob).json()["contacts"]] == ["alice"]
    assert client.post("/v1/contacts", headers=alice, json={"user_id": 900001}).status_code == 422
    assert client.post("/v1/contacts", headers=alice, json={"user_id": 42}).status_code == 404
    assert client.post("/v1/contacts", headers=alice, json={"user_id": 900002}).json()["created"] is False
    assert client.get("/v1/conversations", headers=dave).json()["conversations"] == []
    alice_list = client.get("/v1/conversations", headers=alice).json()["conversations"]
    assert len(alice_list) == 3 and alice_list[0]["last_activity_at"] >= alice_list[1]["last_activity_at"]
    assert any(row["unread_count"] > 0 for row in alice_list)
    assert all(row["unread_count"] > 0 for row in client.get("/v1/conversations?filter=unread", headers=alice).json()["conversations"])
    assert client.get("/v1/conversations?query=riverside", headers=alice).json()["conversations"] == []
    assert len(client.get("/v1/conversations?query=bob", headers=alice).json()["conversations"]) >= 1
    for path in ("/v1/conversations/900001", "/v1/conversations/900001/messages", "/v1/conversations/900003/messages"):
        assert client.get(path, headers=dave).status_code == 404
    assert len(client.get("/v1/conversations/900003/messages", headers=bob).json()["messages"]) == 2
    assert client.get("/v1/conversations/1234567", headers=alice).status_code == 404
    assert client.get("/v1/conversations/900001/messages?before_id=1&after_id=2", headers=alice).status_code == 422
    assert client.get("/v1/conversations/900001/messages?limit=101", headers=alice).status_code == 422


def test_contacts_directional_and_direct_concurrency(client, settings, engine):
    seed_database(settings)
    bob, carol = login(client, "bob"), login(client, "carol")
    assert client.post("/v1/contacts", headers=bob, json={"user_id": 900003}).status_code == 201
    assert client.post("/v1/contacts", headers=bob, json={"user_id": 900003}).status_code == 200
    assert all(item["id"] != 900002 for item in client.get("/v1/contacts", headers=carol).json()["contacts"])

    def create(pair):
        with Session(engine) as db:
            return create_direct(db, *pair)

    with ThreadPoolExecutor(max_workers=6) as pool:
        created = list(pool.map(create, [(900002, 900003), (900003, 900002)] * 3))
    assert len({item[0]["id"] for item in created}) == 1
    assert sum(item[1] for item in created) == 1
    target = created[0][0]["id"]
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(Conversation).where(Conversation.direct_low_user_id == 900002, Conversation.direct_high_user_id == 900003)) == 1
        assert len(db.scalars(select(ConversationMember).where(ConversationMember.conversation_id == target)).all()) == 2
    assert client.post("/v1/conversations/direct", headers=bob, json={"user_id": 900003}).json()["created"] is False
    assert client.post("/v1/conversations/direct", headers=bob, json={"user_id": 900002}).status_code == 422
    assert client.post("/v1/conversations/direct", headers=bob, json={"user_id": 42}).status_code == 404


def test_send_idempotence_receipts_pagination_and_recreation(client, settings, engine):
    seed_database(settings)
    alice, bob, dave = (login(client, name) for name in ("alice", "bob", "dave"))
    path = "/v1/conversations/900001/messages"
    uid = str(uuid4())
    payload = {"client_message_id": uid, "body": "Hello 🌿\nSecond line"}
    response = client.post(path, headers=alice, json=payload)
    assert response.status_code == 201, response.text
    message = response.json()["message"]
    assert message["status"] == "sent" and message["sender_id"] == 900001 and message["body"] == payload["body"]
    assert client.post(path, headers=alice, json=payload).json() == {"message": message, "created": False}
    assert client.post(path, headers=alice, json={**payload, "body": "changed"}).status_code == 409
    assert client.post("/v1/conversations/900002/messages", headers=alice, json=payload).status_code == 409
    assert client.post(path, headers=dave, json={**payload, "client_message_id": str(uuid4())}).status_code == 404
    assert client.post("/v1/conversations/900003/messages", headers=alice, json={**payload, "client_message_id": str(uuid4())}).status_code == 201
    for value in ("  ", "x" * 4001):
        assert client.post(path, headers=alice, json={"client_message_id": str(uuid4()), "body": value}).status_code == 422
    assert client.post(path, headers=alice, json={"client_message_id": "bad", "body": "test"}).status_code == 422
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(Message).where(Message.sender_id == 900001, Message.client_message_id == uid)) == 1
        receipt = db.get(MessageReceipt, (message["id"], 900002))
        assert receipt and receipt.read_at is None and receipt.delivered_at is None
    assert client.get("/v1/conversations/900001", headers=bob).json()["conversation"]["unread_count"] >= 1
    history = client.get(path + "?limit=1", headers=bob).json()
    assert history["messages"][0]["id"] == message["id"] and history["next_before_id"]
    assert client.get(path + f'?before_id={history["next_before_id"]}&limit=1', headers=bob).status_code == 200
    assert client.get(path + f'?after_id={message["id"] - 1}', headers=bob).json()["messages"][-1]["id"] == message["id"]
    with __import__("fastapi").testclient.TestClient(create_app(settings), headers={"X-Internal-API-Key": client.headers["X-Internal-API-Key"], "Origin": ORIGIN}) as recreated:
        assert recreated.get(path, headers=bob).json()["messages"][-1]["id"] == message["id"]


def test_rest_unicode_message_character_boundary(client, settings):
    seed_database(settings)
    alice = login(client, "alice")
    body = "🌿" * 4000
    response = client.post("/v1/conversations/900001/messages", headers=alice,
                           json={"client_message_id": str(uuid4()), "body": body})
    assert response.status_code == 201, response.text
    assert response.json()["message"]["body"] == body
    assert client.post("/v1/conversations/900001/messages", headers=alice,
                       json={"client_message_id": str(uuid4()), "body": body + "🌿"}).status_code == 422


def test_websocket_tickets_authorization_and_multisession_delivery(client, settings):
    seed_database(settings)
    alice, bob, carol = (login(client, name) for name in ("alice", "bob", "carol"))
    original = ticket(client, alice)
    with client.websocket_connect("/v1/ws", headers={"Origin": ORIGIN}) as first:
        first.send_json({"v": 1, "type": "auth", "payload": {"ticket": original}})
        assert first.receive_json()["type"] == "ready"
        with client.websocket_connect("/v1/ws", headers={"Origin": ORIGIN}) as second:
            second.send_json({"v": 1, "type": "auth", "payload": {"ticket": ticket(client, alice)}})
            assert second.receive_json()["type"] == "ready"
            with client.websocket_connect("/v1/ws", headers={"Origin": ORIGIN}) as peer:
                peer.send_json({"v": 1, "type": "auth", "payload": {"ticket": ticket(client, bob)}})
                assert peer.receive_json()["type"] == "ready"
                with client.websocket_connect("/v1/ws", headers={"Origin": ORIGIN}) as outsider:
                    outsider.send_json({"v": 1, "type": "auth", "payload": {"ticket": ticket(client, carol)}})
                    assert outsider.receive_json()["type"] == "ready"
                    first.send_json({"v": 1, "type": "message.send", "request_id": "a1", "conversation_id": 900001,
                                     "payload": {"client_message_id": str(uuid4()), "body": "Alice to Bob live"}})
                    assert first.receive_json()["type"] == "message.created"
                    assert first.receive_json()["type"] == "conversation.updated"
                    assert first.receive_json()["type"] == "message.accepted"
                    assert second.receive_json()["payload"]["message"]["body"] == "Alice to Bob live"
                    assert second.receive_json()["type"] == "conversation.updated"
                    assert peer.receive_json()["payload"]["message"]["body"] == "Alice to Bob live"
                    assert peer.receive_json()["type"] == "conversation.updated"
                    outsider.send_json({"v": 1, "type": "ping", "request_id": "c1"})
                    assert outsider.receive_json()["type"] == "pong"
                    outsider.send_json({"v": 1, "type": "message.send", "request_id": "bad", "conversation_id": 900001,
                                       "payload": {"client_message_id": str(uuid4()), "body": "Forbidden"}})
                    assert outsider.receive_json()["payload"]["code"] == "CONVERSATION_NOT_FOUND"
    with client.websocket_connect("/v1/ws", headers={"Origin": ORIGIN}) as reused:
        reused.send_json({"v": 1, "type": "auth", "payload": {"ticket": original}})
        with pytest.raises(WebSocketDisconnect):
            reused.receive_json()
    with client.websocket_connect("/v1/ws", headers={"Origin": ORIGIN}) as invalid:
        invalid.send_json({"v": 1, "type": "auth", "payload": {"ticket": "x" * 43}})
        with pytest.raises(WebSocketDisconnect):
            invalid.receive_json()
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/v1/ws", headers={"Origin": "http://evil.example"}):
            pass
    expired = ticket(client, alice)
    session_id, origin, _ = client.app.state.tickets._items[expired]
    client.app.state.tickets._items[expired] = (session_id, origin, 0)
    with client.websocket_connect("/v1/ws", headers={"Origin": ORIGIN}) as old:
        old.send_json({"v": 1, "type": "auth", "payload": {"ticket": expired}})
        with pytest.raises(WebSocketDisconnect):
            old.receive_json()
    with client.websocket_connect("/v1/ws", headers={"Origin": ORIGIN}) as guest:
        guest.send_json({"v": 1, "type": "ping"})
        with pytest.raises(WebSocketDisconnect):
            guest.receive_json()
    revoked = ticket(client, bob)
    assert client.post("/v1/auth/logout", headers=bob, json={}).status_code == 200
    with client.websocket_connect("/v1/ws", headers={"Origin": ORIGIN}) as dead:
        dead.send_json({"v": 1, "type": "auth", "payload": {"ticket": revoked}})
        with pytest.raises(WebSocketDisconnect):
            dead.receive_json()
