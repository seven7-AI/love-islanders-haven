import time
import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

REQUEST_ID_HEADER = "X-Request-ID"
log = structlog.get_logger()


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Assigns a request id (or keeps a valid incoming one), binds it to log context, logs each request."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        incoming = request.headers.get(REQUEST_ID_HEADER, "")
        request_id = incoming if _is_safe_id(incoming) else uuid.uuid4().hex
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)
        start = time.perf_counter()
        response = await call_next(request)
        response.headers[REQUEST_ID_HEADER] = request_id
        log.info(
            "request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=round((time.perf_counter() - start) * 1000, 1),
        )
        return response


def _is_safe_id(value: str) -> bool:
    return 0 < len(value) <= 64 and all(c.isalnum() or c in "-_" for c in value)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Conservative headers for a JSON API. The interactive docs page (non-production only) needs scripts, so the
    strict CSP is not applied there."""

    def __init__(self, app: object, *, hsts: bool) -> None:
        super().__init__(app)  # type: ignore[arg-type]
        self._hsts = hsts

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        headers = response.headers
        headers.setdefault("X-Content-Type-Options", "nosniff")
        headers.setdefault("X-Frame-Options", "DENY")
        headers.setdefault("Referrer-Policy", "no-referrer")
        headers.setdefault("Permissions-Policy", "geolocation=(), camera=(), microphone=()")
        if not request.url.path.startswith(("/docs", "/openapi.json")):
            headers.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
        if request.url.path.startswith("/v1/"):
            headers.setdefault("Cache-Control", "no-store")
        if self._hsts:
            headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: object, *, max_bytes: int) -> None:
        super().__init__(app)  # type: ignore[arg-type]
        self._max = max_bytes

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        length = request.headers.get("content-length")
        if length is not None and length.isdigit() and int(length) > self._max:
            from app.core.errors import problem

            return problem(413, "Request body too large")
        return await call_next(request)
