"""Explicit developer setup; never overwrites environment files or prints secrets."""
import secrets
from pathlib import Path

from dotenv import dotenv_values


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    backend_env, frontend_env = root / "backend/.env", root / "frontend/.env"
    if backend_env.exists() or frontend_env.exists():
        if backend_env.exists() and frontend_env.exists() and dotenv_values(backend_env).get("INTERNAL_API_KEY") == dotenv_values(frontend_env).get("INTERNAL_API_KEY"):
            print("Both environment files already exist; preserved without changes.")
            return
        raise SystemExit("Existing environment files need manual review; nothing overwritten.")
    key = secrets.token_urlsafe(48)
    backend_env.write_text(f"FRONTEND_ORIGIN=http://127.0.0.1:3000\nHOST=127.0.0.1\nPORT=8000\nDATABASE_PATH=data/signal.sqlite3\nINTERNAL_API_KEY={key}\n", encoding="utf-8")
    frontend_env.write_text(f"BACKEND_BASE_URL=http://127.0.0.1:8000\nFRONTEND_ORIGIN=http://127.0.0.1:3000\nINTERNAL_API_KEY={key}\n", encoding="utf-8")
    print("Created ignored backend/.env and frontend/.env with a shared local key. No database changed.")


if __name__ == "__main__":
    main()
