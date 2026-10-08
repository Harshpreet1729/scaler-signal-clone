from pathlib import Path

import pytest

from app.settings import Settings


def test_environment_overrides_dotenv(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text("PORT=8200\nFRONTEND_ORIGIN=http://127.0.0.1:3200\n", encoding="utf-8")
    monkeypatch.delenv("FRONTEND_ORIGIN", raising=False)
    monkeypatch.setenv("HOST", "127.0.0.1")
    monkeypatch.setenv("PORT", "8100")
    assert Settings.from_env(env_file) == Settings("http://127.0.0.1:3200", "127.0.0.1", 8100)


def test_invalid_port_rejected(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("FRONTEND_ORIGIN", "http://127.0.0.1:3000")
    monkeypatch.setenv("PORT", "70000")
    with pytest.raises(ValueError, match="PORT"):
        Settings.from_env(tmp_path / "missing.env")
