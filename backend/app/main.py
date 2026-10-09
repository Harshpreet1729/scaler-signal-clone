import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError

from app.auth import APIError, RateLimiter
from app.database import make_engine
from app.routes.auth import router as auth_router
from app.routes.conversations import router as conversations_router
from app.routes.groups import router as groups_router
from app.routes.receipts import router as receipts_router
from app.routes.socket import router as socket_router
from app.realtime import SocketManager, TicketStore

from app.routes.health import router as health_router
from app.settings import Settings


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings if settings is not None else Settings.from_env()
    engine = make_engine(settings.database_path)

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        typing_task = asyncio.create_task(_app.state.sockets.typing_loop())
        try:
            yield
        finally:
            typing_task.cancel()
            with suppress(asyncio.CancelledError):
                await typing_task
            engine.dispose()

    app = FastAPI(title="Scaler Signal API", version="0.2.0", lifespan=lifespan)
    app.state.settings, app.state.engine = settings, engine
    app.state.auth_limiter = RateLimiter(settings.auth_rate_limit)
    app.state.tickets = TicketStore()
    app.state.sockets = SocketManager(engine)

    @app.middleware("http")
    async def private_headers(request: Request, call_next):
        message_path = request.url.path.startswith("/v1/conversations/") and request.url.path.endswith("/messages")
        body_limit = 32768 if message_path else 8192
        if request.method in {"POST", "PATCH"} and len(await request.body()) > body_limit:
            return JSONResponse({"error": {"code": "BODY_TOO_LARGE", "message": "Request is too large."}}, status_code=413, headers={"Cache-Control": "no-store"})
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.exception_handler(APIError)
    async def api_error(_request: Request, error: APIError):
        return JSONResponse({"error": {"code": error.code, "message": error.message}}, status_code=error.status)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_request: Request, error: RequestValidationError):
        fields = sorted({str(item["loc"][-1])[:80] for item in error.errors()})
        return JSONResponse({"error": {"code": "VALIDATION", "message": "Check the submitted fields.", "fields": fields}}, status_code=422)

    @app.exception_handler(OperationalError)
    async def database_error(_request: Request, _error: OperationalError):
        return JSONResponse({"error": {"code": "DATABASE_UNAVAILABLE", "message": "Database unavailable. Run migrations or retry shortly."}}, status_code=503)
    app.include_router(health_router, prefix="/v1")
    app.include_router(auth_router, prefix="/v1")
    app.include_router(conversations_router, prefix="/v1")
    app.include_router(groups_router, prefix="/v1")
    app.include_router(receipts_router, prefix="/v1")
    app.include_router(socket_router, prefix="/v1")
    return app
