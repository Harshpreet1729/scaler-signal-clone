from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient

from app.database import make_engine
from app.main import create_app
from app.settings import Settings

TEST_KEY = "phase-two-test-only-gateway-key-123456789"
ORIGIN = "http://127.0.0.1:3000"


def migrate(path: Path) -> None:
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    config.attributes["database_path"] = path
    command.upgrade(config, "head")


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    value = Settings(ORIGIN, "127.0.0.1", 8000, database_path=tmp_path / "test.sqlite3", internal_api_key=TEST_KEY, auth_rate_limit=1000)
    migrate(value.database_path)
    return value


@pytest.fixture
def engine(settings):
    value = make_engine(settings.database_path)
    yield value
    value.dispose()


@pytest.fixture
def client(settings):
    with TestClient(create_app(settings), headers={"X-Internal-API-Key": TEST_KEY, "Origin": ORIGIN}) as value:
        yield value
