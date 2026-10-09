"""Errors are returned as RFC 9457 problem details (application/problem+json)."""

from http import HTTPStatus
from typing import Any

import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = structlog.get_logger()

PROBLEM_JSON = "application/problem+json"


class AppError(Exception):
    """An expected failure with a client-safe message."""

    def __init__(self, status: int, detail: str, *, code: str | None = None, retry_after: float | None = None) -> None:
        super().__init__(detail)
        self.status = status
        self.detail = detail
        self.code = code
        self.retry_after = retry_after


def problem(status: int, detail: str | None = None, **extra: Any) -> JSONResponse:
    body: dict[str, Any] = {"type": "about:blank", "title": HTTPStatus(status).phrase, "status": status}
    if detail:
        body["detail"] = detail
    body.update({k: v for k, v in extra.items() if v is not None})
    return JSONResponse(body, status_code=status, media_type=PROBLEM_JSON)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        response = problem(exc.status, exc.detail, code=exc.code)
        if exc.status == 401:
            response.headers["WWW-Authenticate"] = "Bearer"
        if exc.retry_after is not None:
            response.headers["Retry-After"] = str(max(1, round(exc.retry_after)))
        return response

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        detail = exc.detail if isinstance(exc.detail, str) else None
        response = problem(exc.status_code, detail)
        if exc.headers:
            response.headers.update(exc.headers)
        return response

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [{"loc": list(e["loc"]), "msg": e["msg"], "type": e["type"]} for e in exc.errors()]
        return problem(422, "Request validation failed", errors=errors)

    @app.exception_handler(Exception)
    async def handle_unexpected(_: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled_error", error_type=type(exc).__name__)
        return problem(500, "An unexpected error occurred")
