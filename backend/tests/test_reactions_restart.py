"""Real process restart, network authentication and durable reaction recovery."""
import os
from pathlib import Path
import socket
import subprocess
import sys
import time

import httpx2 as httpx
from websockets.sync.client import connect

from app.seed import seed_database
from conftest import ORIGIN, TEST_KEY
from test_direct_phase4 import login, ticket


def test_reactions_survive_real_startup_process_restart(settings):
    seed_database(settings)
    with socket.socket() as reservation:
        reservation.bind(("127.0.0.1", 0))
        port = reservation.getsockname()[1]
    env = {**os.environ, "PORT": str(port), "DATABASE_PATH": str(settings.database_path),
           "FRONTEND_ORIGIN": ORIGIN, "INTERNAL_API_KEY": TEST_KEY, "AUTH_RATE_LIMIT": "1000"}
    env.pop("RAILWAY_ENVIRONMENT_ID", None)
    env.pop("RAILWAY_VOLUME_MOUNT_PATH", None)

    def start():
        process = subprocess.Popen([sys.executable, "-m", "app.startup"], cwd=Path(__file__).resolve().parents[1],
                                   env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        deadline = time.monotonic() + 12
        while time.monotonic() < deadline:
            if process.poll() is not None:
                raise AssertionError("Local backend exited during startup")
            try:
                if httpx.get(f"http://127.0.0.1:{port}/v1/health/live", timeout=0.5).status_code == 200:
                    return process
            except httpx.HTTPError:
                pass
            time.sleep(0.1)
        process.terminate()
        process.wait(timeout=5)
        raise AssertionError("Local backend startup timed out")

    def authenticate(ws, client, headers):
        import json
        ws.send(json.dumps({"v": 1, "type": "auth", "payload": {"ticket": ticket(client, headers)}}))
        assert json.loads(ws.recv(timeout=3))["type"] == "ready"

    import json
    process = start()
    try:
        with httpx.Client(base_url=f"http://127.0.0.1:{port}", headers={"X-Internal-API-Key": TEST_KEY, "Origin": ORIGIN}, timeout=5) as client:
            alice, bob = login(client, "alice"), login(client, "bob")
            message = client.get("/v1/conversations/900001/messages", headers=alice).json()["messages"][-1]
            path = "/v1/conversations/900001/reactions"
            with connect(f"ws://127.0.0.1:{port}/v1/ws", origin=ORIGIN, proxy=None, open_timeout=3, close_timeout=1) as ws:
                authenticate(ws, client, alice)
                result = client.post(path, headers=bob, json={"message_id": message["id"], "emoji": "❤️", "active": True})
                assert result.status_code == 200
                event = json.loads(ws.recv(timeout=3))
                assert event["type"] == "reaction.updated" and event["payload"]["message"]["reactions"][0]["count"] == 1
            process.terminate()
            process.wait(timeout=5)
            process = start()  # Same file, intended production startup (migration then one worker).
            saved = client.get("/v1/conversations/900001/messages", headers=alice).json()["messages"][-1]
            assert saved["reactions"] == [{"emoji": "❤️", "count": 1, "user_ids": [900002]}]
            assert saved["reaction_version"] == 1
            with connect(f"ws://127.0.0.1:{port}/v1/ws", origin=ORIGIN, proxy=None, open_timeout=3, close_timeout=1) as ws:
                authenticate(ws, client, alice)  # Old session still works; mint a new single-use ticket.
                result = client.post(path, headers=bob, json={"message_id": message["id"], "emoji": "❤️", "active": False})
                assert result.status_code == 200
                changed = json.loads(ws.recv(timeout=3))["payload"]["message"]
                assert changed["reactions"] == [] and changed["reaction_version"] == 2
    finally:
        if process.poll() is None:
            process.terminate()
            process.wait(timeout=5)
