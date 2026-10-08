"""Explicit local configuration; environment overrides ignored dotenv files."""

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    frontend_origin: str
    host: str
    port: int
    database_path: Path = Path(__file__).resolve().parents[1] / "data" / "signal.sqlite3"
    internal_api_key: str = ""
    session_seconds: int = 604800
    challenge_seconds: int = 300
    auth_rate_limit: int = 30

    @classmethod
    def from_env(cls, env_file: Path | None = None) -> "Settings":
        load_dotenv(
            env_file if env_file is not None else Path(__file__).resolve().parents[1] / ".env",
            override=False,
        )
        origin = os.getenv("FRONTEND_ORIGIN", "http://127.0.0.1:3000")
        parsed = urlsplit(origin)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.netloc or parsed.username or parsed.password
            or parsed.path or parsed.query or parsed.fragment
        ):
            raise ValueError("FRONTEND_ORIGIN must be an HTTP(S) origin without a path")
        port = int(os.getenv("PORT", "8000"))
        if not 1 <= port <= 65535:
            raise ValueError("PORT must be between 1 and 65535")
        database_path = Path(os.getenv("DATABASE_PATH", "data/signal.sqlite3"))
        if not database_path.is_absolute():
            database_path = Path(__file__).resolve().parents[1] / database_path
        values = {name: int(os.getenv(env, str(default))) for name, env, default in (
            ("session_seconds", "SESSION_SECONDS", 604800),
            ("challenge_seconds", "CHALLENGE_SECONDS", 300),
            ("auth_rate_limit", "AUTH_RATE_LIMIT", 30),
        )}
        if any(value < 1 for value in values.values()):
            raise ValueError("Auth durations and rate limit must be positive")
        return cls(frontend_origin=origin, host=os.getenv("HOST", "127.0.0.1"), port=port,
                   database_path=database_path.resolve(), internal_api_key=os.getenv("INTERNAL_API_KEY", ""), **values)
