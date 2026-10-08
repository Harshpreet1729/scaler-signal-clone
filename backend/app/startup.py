"""Production entry point: validate storage, migrate, then run one worker. Never seed."""

import os
from pathlib import Path

import uvicorn
from alembic import command
from alembic.config import Config

from app.main import create_app
from app.settings import Settings


def production_settings() -> Settings:
    # Require explicit deployment inputs instead of silently using local defaults.
    for name in ("DATABASE_PATH", "FRONTEND_ORIGIN", "INTERNAL_API_KEY", "PORT"):
        if not os.environ.get(name):
            raise ValueError(f"{name} is required for production startup")
    if not Path(os.environ["DATABASE_PATH"]).is_absolute():
        raise ValueError("DATABASE_PATH must be absolute for production startup")
    settings = Settings.from_env()
    if len(settings.internal_api_key) < 32:
        raise ValueError("INTERNAL_API_KEY must contain at least 32 characters")
    if not settings.database_path.parent.is_dir():
        raise ValueError("Database directory must already exist; attach storage before startup")
    if os.environ.get("RAILWAY_ENVIRONMENT_ID"):
        mount = os.environ.get("RAILWAY_VOLUME_MOUNT_PATH")
        if mount != "/data" or settings.database_path != Path("/data/signal.sqlite3"):
            raise ValueError("Railway requires a volume at /data and DATABASE_PATH=/data/signal.sqlite3")
        if not settings.frontend_origin.startswith("https://"):
            raise ValueError("Railway FRONTEND_ORIGIN must use HTTPS")
    return settings


def main() -> None:
    settings = production_settings()
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    config.attributes["database_path"] = settings.database_path
    # Exceptions propagate: a failed migration must never start an HTTP server.
    command.upgrade(config, "head")
    uvicorn.run(create_app(settings), host="0.0.0.0", port=settings.port,
                workers=1, ws_max_size=65536)


if __name__ == "__main__":
    main()
