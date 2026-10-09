from contextlib import ExitStack
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy.orm import Session

from app.models import Conversation, MessageReceipt
from app.seed import seed_database
from test_direct_phase4 import login
from test_groups_phase5 import connect, drain, send


def test_receipts_monotonic_atomic_own_recipient_and_offline(client, settings, engine):
    seed_database(settings)
    alice, bob, carol = (login(client, name) for name in ("alice", "bob", "carol"))
    message = send(client, alice, 900001).json()["message"]
    assert message["status"] == "sent"  # No recipient acknowledgment, even with an active login.
    mid = message["id"]
    path = "/v1/conversations/900001"
    def ack(identity, kind, ids):
        return client.post(path + "/" + kind, headers=identity, json={"message_ids": ids})
    for ids in ([], [mid] * 101, [True], [-1]):
        assert ack(bob, "read", ids).status_code == 422
    assert ack(alice, "read", [mid]).status_code == 404
    assert ack(carol, "delivered", [mid]).status_code == 404
    other = send(client, alice, 900003).json()["message"]["id"]
    assert ack(bob, "read", [mid, other]).status_code == 404
    with Session(engine) as db:
        assert db.get(MessageReceipt, (mid, 900002)).read_at is None
        activity = db.get(Conversation, 900001).last_activity_at
    assert ack(bob, "delivered", [mid, mid]).json()["messages"][0]["status"] == "delivered"
    assert ack(bob, "read", [mid]).json()["messages"][0]["status"] == "read"
    with Session(engine) as db:
        row = db.get(MessageReceipt, (mid, 900002))
        timestamps = row.delivered_at, row.read_at
        assert row.read_at >= row.delivered_at >= message["created_at"]
    assert ack(bob, "delivered", [mid]).json()["messages"] == []
    assert ack(bob, "read", [mid]).json()["messages"] == []
    with Session(engine) as db:
        row = db.get(MessageReceipt, (mid, 900002))
        assert (row.delivered_at, row.read_at) == timestamps
        assert db.get(Conversation, 900001).last_activity_at == activity


def test_group_read_implies_delivered_original_cohort_and_removed_denial(client, settings):
    seed_database(settings)
    alice, bob, carol, dave = (login(client, name) for name in ("alice", "bob", "carol", "dave"))
    message = send(client, alice).json()["message"]
    path = "/v1/conversations/900003"
    payload = {"message_ids": [message["id"]]}
    first = client.post(path + "/read", headers=bob, json=payload).json()["messages"][0]
    assert first["status"] == "sent" and first["read_ids"] == [900002] and first["delivered_ids"] == [900002]
    client.post(path + "/members", headers=alice, json={"user_ids": [900004]})
    assert client.post(path + "/read", headers=dave, json=payload).status_code == 404
    client.delete(path + "/members/900003", headers=alice)
    assert client.post(path + "/read", headers=carol, json=payload).status_code == 404
    client.post(path + "/members", headers=alice, json={"user_ids": [900003]})
    final = client.post(path + "/read", headers=carol, json=payload).json()["messages"][0]
    assert final["status"] == "read" and set(final["recipient_ids"]) == {900002, 900003}


def test_receipt_event_reaches_sender_other_tab_and_recipient_sessions(client, settings):
    seed_database(settings)
    alice, bob, dave = (login(client, name) for name in ("alice", "bob", "dave"))
    with ExitStack() as stack:
        sockets = [connect(client, identity, stack) for identity in (alice, alice, bob, dave)]
        mid = send(client, alice, 900001).json()["message"]["id"]
        for ws in sockets:
            drain(ws)
        result = client.post("/v1/conversations/900001/read", headers=bob, json={"message_ids": [mid]})
        assert result.status_code == 200
        for ws in sockets[:3]:
            frame = ws.receive_json()
            assert frame["type"] == "receipt.updated" and frame["payload"]["message"]["status"] == "read"
        assert not drain(sockets[3])


def test_concurrent_acknowledgments_do_not_retain_auth_pool_connections(client, settings):
    seed_database(settings)
    alice, bob = login(client, "alice"), login(client, "bob")
    ids = [send(client, alice, 900001, body=f"Burst {index}").json()["message"]["id"] for index in range(24)]
    with ExitStack() as stack:
        ws = connect(client, alice, stack)
        def ack(mid):
            return client.post("/v1/conversations/900001/read", headers=bob, json={"message_ids": [mid]}).status_code
        with ThreadPoolExecutor(max_workers=24) as pool:
            assert list(pool.map(ack, ids, timeout=15)) == [200] * 24
        frames = drain(ws)
        assert len([frame for frame in frames if frame["type"] == "receipt.updated"]) == 24
        assert client.app.state.engine.pool.checkedout() == 0
