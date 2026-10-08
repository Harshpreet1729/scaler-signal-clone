from fastapi.testclient import TestClient

from app.main import create_app
from app.settings import Settings


def test_live_health_contract() -> None:
    with TestClient(create_app(Settings("http://127.0.0.1:3000", "127.0.0.1", 8000))) as client:
        response = client.get("/v1/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "scaler-signal-api"}
    assert response.headers["content-type"] == "application/json"
    assert response.headers["cache-control"] == "no-store"


def test_unknown_route_is_404() -> None:
    with TestClient(create_app(Settings("http://127.0.0.1:3000", "127.0.0.1", 8000))) as client:
        response = client.get("/v1/does-not-exist")
    assert response.status_code == 404
    assert response.json() == {"detail": "Not Found"}
