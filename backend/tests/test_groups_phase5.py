from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import APIError
from app.models import Message, MessageReceipt, User
from app.seed import seed_database
from app.services.direct import send_direct
from app.services.groups import change_group
from conftest import ORIGIN
from test_direct_phase4 import login, ticket


def send(client, headers, group=900003, body="Group hello", uid=None):
    return client.post(f"/v1/conversations/{group}/messages", headers=headers,
                       json={"body": body, "client_message_id": uid or str(uuid4())})


def connect(client, headers, stack):
    ws = stack.enter_context(client.websocket_connect("/v1/ws", headers={"Origin": ORIGIN}))
    ws.send_json({"v": 1, "type": "auth", "payload": {"ticket": ticket(client, headers)}})
    assert ws.receive_json()["type"] == "ready"
    return ws


def drain(ws):
    ws.send_json({"v": 1, "type": "ping", "request_id": "barrier"})
    frames = []
    while True:
        frame = ws.receive_json()
        if frame.get("request_id") == "barrier":
            return frames
        frames.append(frame)


def test_group_create_validation_and_admin_rules(client, settings):
    seed_database(settings)
    alice, bob = login(client, "alice"), login(client, "bob")
    for name in (" ", "x" * 101, "bad\nname"):
        assert client.post("/v1/conversations/groups", headers=alice, json={"name": name, "user_ids": [900002]}).status_code == 422
    for ids, status in (([42], 404), ([True], 422), ([], 422), ([900001], 422), (list(range(101)), 422)):
        assert client.post("/v1/conversations/groups", headers=alice, json={"name": "Test", "user_ids": ids}).status_code == status
    response = client.post("/v1/conversations/groups", headers=alice, json={"name": " Picnic ", "user_ids": [900002, 900003, 900002, 900001]})
    assert response.status_code == 201
    group = response.json()["conversation"]
    assert group["name"] == "Picnic" and len(group["members"]) == 3
    assert next(person for person in group["members"] if person["id"] == 900001)["role"] == "admin"
    path = f'/v1/conversations/{group["id"]}'
    assert client.patch(path, headers=bob, json={"name": "No"}).status_code == 403
    assert client.post(path + "/members", headers=bob, json={"user_ids": [900004]}).status_code == 403
    assert client.delete(path + "/members/900003", headers=bob).status_code == 403
    assert client.delete(path + "/members/900001", headers=alice).status_code == 409
    assert client.patch(path, headers=alice, json={"name": "Renamed"}).json()["conversation"]["name"] == "Renamed"
    assert client.post("/v1/conversations/900001/members", headers=alice, json={"user_ids": [900003]}).status_code == 422


def test_group_cohort_remove_rejoin_history_and_idempotence(client, settings, engine):
    seed_database(settings)
    alice, carol, dave = (login(client, name) for name in ("alice", "carol", "dave"))
    uid = str(uuid4())
    message = send(client, alice, uid=uid).json()["message"]
    assert send(client, alice, uid=uid).json()["created"] is False
    assert send(client, alice, uid=uid, body="changed").status_code == 409
    path = "/v1/conversations/900003"
    assert client.get(path + "/messages", headers=dave).status_code == 404
    assert send(client, dave).status_code == 404
    assert client.post(path + "/members", headers=alice, json={"user_ids": [900004]}).status_code == 200
    assert message["id"] in [m["id"] for m in client.get(path + "/messages", headers=dave).json()["messages"]]
    assert client.delete(path + "/members/900003", headers=alice).status_code == 200
    assert client.get(path + "/messages", headers=carol).status_code == 404
    assert send(client, carol).status_code == 404
    newer = send(client, alice).json()["message"]
    with Session(engine) as db:
        assert {r.recipient_id for r in db.scalars(select(MessageReceipt).where(MessageReceipt.message_id == message["id"]))} == {900002, 900003}
        assert {r.recipient_id for r in db.scalars(select(MessageReceipt).where(MessageReceipt.message_id == newer["id"]))} == {900002, 900004}
    assert client.post(path + "/members", headers=alice, json={"user_ids": [900003]}).status_code == 200
    assert newer["id"] in [m["id"] for m in client.get(path + "/messages", headers=carol).json()["messages"]]


def test_seeded_group_live_fanout_and_connected_revocation(client, settings):
    from contextlib import ExitStack
    seed_database(settings)
    identities = {name: login(client, name) for name in ("alice", "bob", "carol", "dave")}
    with ExitStack() as stack:
        sockets = {name: connect(client, identity, stack) for name, identity in identities.items()}
        sockets["alice"].send_json({"v": 1, "type": "message.send", "conversation_id": 900003,
                                    "payload": {"body": "Weekend live", "client_message_id": str(uuid4())}})
        assert sockets["alice"].receive_json()["type"] == "message.created"
        for name in ("bob", "carol"):
            assert sockets[name].receive_json()["payload"]["message"]["body"] == "Weekend live"
        for ws in sockets.values():
            drain(ws)
        assert client.delete("/v1/conversations/900003/members/900003", headers=identities["alice"]).status_code == 200
        assert sockets["carol"].receive_json()["type"] == "membership.removed"
        assert send(client, identities["bob"], body="After removal").status_code == 201
        assert not drain(sockets["carol"])
        assert not drain(sockets["dave"])
        sockets["carol"].send_json({"v": 1, "type": "message.send", "conversation_id": 900003,
                                    "payload": {"body": "Denied", "client_message_id": str(uuid4())}})
        assert sockets["carol"].receive_json()["payload"]["code"] == "CONVERSATION_NOT_FOUND"


def test_concurrent_removal_send_has_transactional_order(settings, engine):
    seed_database(settings)
    uid = str(uuid4())
    def sending():
        with Session(engine) as db:
            try:
                return send_direct(db, 900003, 900003, uid, "Racing member")[0]
            except APIError as error:
                assert error.status == 404
                return None
    def removing():
        with Session(engine) as db:
            return change_group(db, 900001, 900003, remove=900003)
    with ThreadPoolExecutor(max_workers=2) as pool:
        future = pool.submit(sending)
        pool.submit(removing).result()
        message = future.result()
    with Session(engine) as db:
        rows = db.scalars(select(Message).where(Message.client_message_id == uid)).all()
        assert len(rows) == (1 if message else 0)
        try:
            send_direct(db, 900003, 900003, str(uuid4()), "After removal")
            assert False, "Removed sender accepted"
        except APIError as error:
            assert error.status == 404


def test_group_active_member_limit_on_add(client, settings, engine):
    seed_database(settings)
    with Session(engine) as db:
        db.add_all(User(id=1000 + index, username=f"limit_{index}", display_name=f"Member {index}", avatar_key="sky", created_at=1) for index in range(98))
        db.commit()
    alice = login(client, "alice")
    ids = list(range(1000, 1097))
    assert client.post("/v1/conversations/900003/members", headers=alice, json={"user_ids": ids}).status_code == 200
    assert len(client.get("/v1/conversations/900003/members", headers=alice).json()["members"]) == 100
    assert client.post("/v1/conversations/900003/members", headers=alice, json={"user_ids": [1097]}).status_code == 422
