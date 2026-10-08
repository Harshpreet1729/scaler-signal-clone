from uuid import NAMESPACE_URL, uuid5

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Conversation, Message, User
from app.seed import seed_database


def test_unrelated_group_with_same_creator_is_rejected(settings, engine):
    with Session(engine) as db:
        db.add(User(id=900001, username="alice", display_name="Existing Alice", avatar_key="sky", created_at=1))
        db.flush()
        db.add(Conversation(id=900003, kind="group", name="Unrelated", created_by=900001, created_at=1, last_activity_at=1, version=1))
        db.commit()
    with pytest.raises(ValueError, match="fixture identity"):
        seed_database(settings)
    with Session(engine) as db:
        assert len(db.scalars(select(User)).all()) == 1
        assert db.get(Conversation, 900003).name == "Unrelated"


def test_reserved_message_uuid_collision_is_rejected(settings, engine):
    seed_database(settings)
    with Session(engine) as db:
        message = db.scalar(select(Message).where(Message.client_message_id == str(uuid5(NAMESPACE_URL, "scaler-signal-demo/message/1"))))
        message.sender_id = 900002  # Both users are members, so SQL permits this collision.
        db.commit()
    with pytest.raises(ValueError, match="message collision"):
        seed_database(settings)
