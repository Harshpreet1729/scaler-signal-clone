import pytest
from sqlalchemy import inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Contact, Conversation, ConversationMember, Message, MessageReceipt, User
from app.seed import seed_database
from conftest import migrate


def counts(engine) -> dict:
    with engine.connect() as connection:
        return {table: connection.scalar(text(f"SELECT count(*) FROM {table}")) for table in
                ("users", "contacts", "conversations", "conversation_members", "messages", "message_receipts")}


def test_migration_tables_pragmas_indexes_and_rerun(settings, engine):
    assert set(inspect(engine).get_table_names()) == {"alembic_version", "users", "auth_challenges", "sessions", "contacts", "conversations", "conversation_members", "messages", "message_receipts"}
    for _ in range(2):
        with engine.connect() as connection:
            assert connection.scalar(text("PRAGMA foreign_keys")) == 1
            assert connection.scalar(text("PRAGMA journal_mode")) == "wal"
            assert connection.scalar(text("PRAGMA busy_timeout")) == 5000
            assert connection.scalar(text("SELECT version_num FROM alembic_version")) == "0001"
            assert connection.execute(text("PRAGMA foreign_key_check")).all() == []
            assert "WHERE read_at IS NULL" in connection.scalar(text("SELECT sql FROM sqlite_master WHERE name='ix_receipts_unread'"))
    seed_database(settings)
    before = counts(engine)
    migrate(settings.database_path)
    assert counts(engine) == before


def test_seed_repeat_preserves_profiles_messages_memberships_and_receipts(settings, engine):
    assert seed_database(settings) == {"users": 4, "contacts": 6, "conversations": 3, "members": 7, "messages": 6, "receipts": 8}
    assert counts(engine) == {"users": 4, "contacts": 6, "conversations": 3, "conversation_members": 7, "messages": 6, "message_receipts": 8}
    with Session(engine) as db:
        db.get(User, 900001).display_name = "Edited Alice"
        group = db.get(Conversation, 900003)
        group.name = "Edited plans"
        member = db.get(ConversationMember, (900003, 900003))
        member.removed_at = member.joined_at + 1000
        message = db.scalar(select(Message).order_by(Message.id))
        message.body = "Edited message"
        receipt = db.scalar(select(MessageReceipt).where(MessageReceipt.read_at.is_(None)))
        receipt.delivered_at = 2000000000000
        receipt.read_at = 2000000001000
        receipt_key = (receipt.message_id, receipt.recipient_id)
        db.commit()
    assert all(value == 0 for value in seed_database(settings).values())
    with Session(engine) as db:
        assert db.get(User, 900001).display_name == "Edited Alice"
        assert db.get(Conversation, 900003).name == "Edited plans"
        assert db.get(ConversationMember, (900003, 900003)).removed_at is not None
        assert db.get(ConversationMember, (900003, 900004)) is None
        assert db.scalar(select(Message).order_by(Message.id)).body == "Edited message"
        assert db.get(MessageReceipt, receipt_key).read_at == 2000000001000
        assert set(db.scalars(select(User.username))) == {"alice", "bob", "carol", "dave"}
        assert db.get(Contact, (900002, 900003)) is None  # directional, not all-to-all
        assert db.get(ConversationMember, (900003, 900001)).role == "admin"
        assert db.scalars(select(MessageReceipt.read_at)).all().count(None) >= 1


@pytest.mark.parametrize("statement", [
    "UPDATE users SET username='ALICE' WHERE id=900001",
    "UPDATE users SET username='bob' WHERE id=900001",
    "UPDATE users SET display_name=' ' WHERE id=900001",
    "UPDATE users SET avatar_key='copied' WHERE id=900001",
    "INSERT INTO contacts VALUES(900001,900001,1)",
    "INSERT INTO contacts VALUES(900001,1,1)",
    "INSERT INTO contacts VALUES(900001,900002,1)",
    "UPDATE conversations SET direct_low_user_id=900002,direct_high_user_id=900001 WHERE id=900001",
    "UPDATE conversations SET direct_high_user_id=900002 WHERE id=900002",
    "UPDATE conversations SET name=' ' WHERE id=900003",
    "UPDATE conversations SET direct_low_user_id=900001 WHERE id=900003",
    "UPDATE conversations SET kind='invalid' WHERE id=900003",
    "UPDATE conversation_members SET role='owner' WHERE user_id=900001",
    "UPDATE conversation_members SET removed_at=0 WHERE user_id=900001",
    "UPDATE messages SET sender_id=900004 WHERE conversation_id=900001",
    "UPDATE messages SET body=' ' WHERE id=1",
    "UPDATE messages SET body=printf('%04001d',1) WHERE id=1",
    "UPDATE messages SET client_message_id='bad' WHERE id=1",
    "INSERT INTO messages(conversation_id,sender_id,client_message_id,body,created_at) SELECT conversation_id,sender_id,client_message_id,body,created_at FROM messages WHERE id=1",
    "UPDATE message_receipts SET conversation_id=900002 WHERE message_id=1",
    "UPDATE message_receipts SET recipient_id=900004 WHERE message_id=1",
    "UPDATE message_receipts SET delivered_at=NULL,read_at=100 WHERE message_id=1",
    "UPDATE message_receipts SET delivered_at=200,read_at=100 WHERE message_id=1",
    "INSERT INTO auth_challenges VALUES('test','alice','invalid',100,0,NULL)",
    "INSERT INTO auth_challenges VALUES('test','alice','register',100,6,NULL)",
    "DELETE FROM users WHERE id=900001",
])
def test_actual_sqlite_constraints(settings, engine, statement):
    seed_database(settings)
    with engine.connect() as connection:
        with pytest.raises(IntegrityError):
            connection.execute(text(statement))
        connection.rollback()


def test_reserved_username_collision_rolls_back_whole_seed(settings, engine):
    with Session(engine) as db:
        db.add(User(id=1, username="alice", display_name="Unrelated demo", avatar_key="sky", created_at=1))
        db.commit()
    with pytest.raises(ValueError, match="collision"):
        seed_database(settings)
    assert counts(engine)["users"] == 1
    assert counts(engine)["conversations"] == 0


def test_reserved_group_collision_rolls_back(settings, engine):
    seed_database(settings)
    with Session(engine) as db:
        db.get(Conversation, 900003).created_by = 900002
        db.commit()
    with pytest.raises(ValueError, match="collision"):
        seed_database(settings)
    assert counts(engine)["messages"] == 6
