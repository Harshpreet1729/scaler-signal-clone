import uvicorn

from app.main import create_app
from app.settings import Settings


if __name__ == "__main__":
    settings = Settings.from_env()
    uvicorn.run(create_app(settings), host=settings.host, port=settings.port, workers=1, ws_max_size=65536)
