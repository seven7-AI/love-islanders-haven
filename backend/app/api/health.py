from typing import Annotated

import structlog
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.deps import get_database
from app.db.session import Database

router = APIRouter(tags=["health"])
log = structlog.get_logger()


@router.get("/healthz")
async def liveness() -> dict[str, str]:
    """The process is up. Does not check dependencies."""
    return {"status": "ok"}


@router.get("/readyz", response_model=None)
async def readiness(db: Annotated[Database, Depends(get_database)]) -> dict[str, str] | JSONResponse:
    """Ready to serve traffic: the database answers."""
    try:
        async with db.engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as exc:
        log.warning("readiness_check_failed", error_type=type(exc).__name__)
        return JSONResponse({"status": "unavailable", "database": "unreachable"}, status_code=503)
    return {"status": "ok", "database": "ok"}
