import sqlite3
from contextlib import closing
from pathlib import Path

from alembic import command, op
from alembic.config import Config
import pytest


def test_additive_migration_failure_is_atomic_then_retry_preserves_data(tmp_path, monkeypatch):
    path = tmp_path / "existing.sqlite3"
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    config.attributes["database_path"] = path
    command.upgrade(config, "0001")
    with closing(sqlite3.connect(path)) as db, db:
        db.execute("INSERT INTO users(id,username,display_name,avatar_key,created_at) VALUES(1,'retained','Retained','sky',1)")
    original = op.create_table
    def fail(*args, **kwargs):
        raise RuntimeError("Simulated failure after ALTER")
    monkeypatch.setattr(op, "create_table", fail)
    with pytest.raises(RuntimeError, match="Simulated failure"):
        command.upgrade(config, "head")
    with closing(sqlite3.connect(path)) as db:
        assert db.execute("SELECT version_num FROM alembic_version").fetchone() == ("0001",)
        assert "reaction_version" not in [row[1] for row in db.execute("PRAGMA table_info(messages)")]
        assert db.execute("SELECT name FROM sqlite_master WHERE name='message_reactions'").fetchall() == []
        assert db.execute("SELECT username FROM users").fetchall() == [("retained",)]
    monkeypatch.setattr(op, "create_table", original)
    command.upgrade(config, "head")
    command.upgrade(config, "head")
    with closing(sqlite3.connect(path)) as db:
        assert db.execute("SELECT version_num FROM alembic_version").fetchone() == ("0002",)
        assert db.execute("SELECT username FROM users").fetchall() == [("retained",)]
        assert db.execute("PRAGMA integrity_check").fetchall() == [("ok",)]
        assert db.execute("PRAGMA foreign_key_check").fetchall() == []
