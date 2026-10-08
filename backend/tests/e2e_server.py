"""Playwright-only explicit migration/seed bootstrap for an isolated DB file."""
from pathlib import Path

import uvicorn
from alembic import command
from alembic.config import Config

from app.main import create_app
from app.seed import seed_database
from app.settings import Settings

settings = Settings.from_env()
if not settings.database_path.parent.name.startswith("scaler-signal-e2e-"):
    raise SystemExit("Refusing to prepare anything except a temporary E2E database.")
config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
config.attributes["database_path"] = settings.database_path
command.upgrade(config, "head")
seed_database(settings)
uvicorn.run(create_app(settings), host=settings.host, port=settings.port, workers=1)
