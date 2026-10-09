from contextlib import ExitStack

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Conversation, Message
from app.seed import seed_database
from test_direct_phase4 import login
from test_groups_phase5 import connect, drain


def typing(ws, active, cid=900001):
    ws.send_json({"v": 1, "type": "typing.set", "conversation_id": cid, "payload": {"typing": active}})


def test_typing_multitab_expiry_authorization_no_database_changes(client, settings, engine):
    seed_database(settings)
    alice, bob, carol = (login(client, name) for name in ("alice", "bob", "carol"))
    with Session(engine) as db:
        count = db.scalar(select(func.count()).select_from(Message))
        activity = db.get(Conversation, 900001).last_activity_at
    with ExitStack() as stack:
        a1, a2, b, outsider = [connect(client, actor, stack) for actor in (alice, alice, bob, carol)]
        typing(a1, True)
        assert b.receive_json()["payload"]["user_ids"] == [900001]
        typing(a2, True)
        assert b.receive_json()["payload"]["user_ids"] == [900001]
        typing(a1, False)
        assert b.receive_json()["payload"]["user_ids"] == [900001]
        assert not drain(outsider)
        typing(outsider, True)
        assert outsider.receive_json()["payload"]["code"] == "CONVERSATION_NOT_FOUND"
        # Advance only ephemeral deadlines, without sleeping or touching application time.
        async def expire():
            manager = client.app.state.sockets
            manager.typing = {key: 0 for key in manager.typing}
            await manager.expire_typing()
        client.portal.call(expire)
        assert b.receive_json()["payload"]["user_ids"] == []
        typing(a2, True)
        assert b.receive_json()["payload"]["user_ids"] == [900001]
        a2.close()
        assert b.receive_json()["payload"]["user_ids"] == []
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(Message)) == count
        assert db.get(Conversation, 900001).last_activity_at == activity


def test_group_typing_removal_and_validation(client, settings):
    seed_database(settings)
    alice, carol, dave = (login(client, name) for name in ("alice", "carol", "dave"))
    with ExitStack() as stack:
        a, c, d = [connect(client, actor, stack) for actor in (alice, carol, dave)]
        typing(c, True, 900003)
        assert a.receive_json()["payload"]["user_ids"] == [900003]
        drain(c)
        assert not drain(d)
        assert client.delete("/v1/conversations/900003/members/900003", headers=alice).status_code == 200
        assert a.receive_json()["payload"]["user_ids"] == []
        assert c.receive_json()["type"] == "membership.removed"
        typing(c, True, 900003)
        assert c.receive_json()["payload"]["code"] == "CONVERSATION_NOT_FOUND"
        typing(d, "true", 900003)
        assert d.receive_json()["payload"]["code"] == "FRAME"
