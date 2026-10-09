"""Deployment startup contracts using real migrations on temporary storage."""

import sqlite3
from contextlib import closing

import pytest

from app import startup


@pytest.fixture
def deployment_env(monkeypatch, tmp_path):
    monkeypatch.delenv("RAILWAY_ENVIRONMENT_ID", raising=False)
    monkeypatch.delenv("RAILWAY_VOLUME_MOUNT_PATH", raising=False)
    for name, value in {
        "DATABASE_PATH": str(tmp_path / "signal.sqlite3"),
        "FRONTEND_ORIGIN": "http://127.0.0.1:3200",
        "INTERNAL_API_KEY": "local-production-test-key-1234567890",
        "PORT": "8200",
    }.items():
        monkeypatch.setenv(name, value)
    return tmp_path / "signal.sqlite3"


def test_migrate_before_single_worker_start_without_seed(monkeypatch, deployment_env):
    starts = []

    def server(app, **kwargs):
        with closing(sqlite3.connect(deployment_env)) as db:
            assert db.execute("SELECT version_num FROM alembic_version").fetchone() == ("0002",)
            assert db.execute("SELECT count(*) FROM users").fetchone() == (0,)
        starts.append(kwargs)

    monkeypatch.setattr(startup.uvicorn, "run", server)
    startup.main()
    with closing(sqlite3.connect(deployment_env)) as db, db:
        db.execute("INSERT INTO users (id, username, display_name, avatar_key, created_at) VALUES (1, 'retained', 'Retained', 'sky', 1)")
    # Restart must retain data and must not insert demo accounts.
    monkeypatch.setattr(startup.uvicorn, "run", lambda app, **kwargs: starts.append(kwargs))
    startup.main()
    with closing(sqlite3.connect(deployment_env)) as db:
        assert db.execute("SELECT username FROM users").fetchall() == [("retained",)]
    assert len(starts) == 2
    assert all(item == {"host": "0.0.0.0", "port": 8200, "workers": 1, "ws_max_size": 65536} for item in starts)


def test_failed_migration_does_not_start_server(monkeypatch, deployment_env):
    def fail(*args):
        raise RuntimeError("migration failed")

    monkeypatch.setattr(startup.command, "upgrade", fail)
    monkeypatch.setattr(startup.uvicorn, "run", lambda *args, **kwargs: pytest.fail("Server must not start"))
    with pytest.raises(RuntimeError, match="migration failed"):
        startup.main()
    assert not deployment_env.exists()


@pytest.mark.parametrize("name,value", [("PORT", ""), ("DATABASE_PATH", "relative.sqlite3"), ("INTERNAL_API_KEY", "short")])
def test_reject_missing_or_unsafe_configuration(monkeypatch, deployment_env, name, value):
    monkeypatch.setenv(name, value)
    with pytest.raises(ValueError):
        startup.production_settings()
    assert not deployment_env.exists()


def test_railway_missing_volume_fails_before_migration(monkeypatch, deployment_env):
    monkeypatch.setenv("RAILWAY_ENVIRONMENT_ID", "local-test-sentinel")
    with pytest.raises(ValueError, match="volume at /data"):
        startup.main()
    assert not deployment_env.exists()


def test_missing_storage_directory_is_not_created(monkeypatch, deployment_env):
    path = deployment_env.parent / "missing" / "signal.sqlite3"
    monkeypatch.setenv("DATABASE_PATH", str(path))
    with pytest.raises(ValueError, match="already exist"):
        startup.main()
    assert not path.parent.exists()
