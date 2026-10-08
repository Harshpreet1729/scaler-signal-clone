from typing import Literal

from fastapi import APIRouter, Response
from pydantic import BaseModel

router = APIRouter(prefix="/health", tags=["health"])


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: Literal["scaler-signal-api"] = "scaler-signal-api"


@router.get("/live", response_model=HealthResponse)
def live(response: Response) -> HealthResponse:
    response.headers["Cache-Control"] = "no-store"
    return HealthResponse()
