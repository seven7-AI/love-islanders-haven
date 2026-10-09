"""Metrics (Prometheus) and optional error tracking (Sentry)."""

import secrets
import time

import structlog
from fastapi import FastAPI, Request, Response
from prometheus_client import CONTENT_TYPE_LATEST, CollectorRegistry, Counter, Histogram, generate_latest
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from app.core.config import Settings
from app.core.errors import problem

log = structlog.get_logger()


class Metrics:
    def __init__(self) -> None:
        # A registry per app keeps tests (which create many apps) independent.
        self.registry = CollectorRegistry()
        self.requests = Counter(
            "http_requests_total", "HTTP requests", ["method", "route", "status"], registry=self.registry
        )
        self.latency = Histogram(
            "http_request_duration_seconds",
            "HTTP request latency",
            ["method", "route"],
            buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
            registry=self.registry,
        )


class MetricsMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: object, *, metrics: Metrics) -> None:
        super().__init__(app)  # type: ignore[arg-type]
        self._metrics = metrics

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        start = time.perf_counter()
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
            return response
        finally:
            # Label by route template (e.g. /v1/matches/{match_id}/messages), never the raw path, to bound cardinality.
            route = request.scope.get("route")
            template = getattr(route, "path", "unmatched")
            self._metrics.requests.labels(request.method, template, str(status)).inc()
            self._metrics.latency.labels(request.method, template).observe(time.perf_counter() - start)


def install_metrics(app: FastAPI, settings: Settings) -> None:
    metrics = Metrics()
    app.state.metrics = metrics
    app.add_middleware(MetricsMiddleware, metrics=metrics)

    @app.get("/metrics", include_in_schema=False)
    async def metrics_endpoint(request: Request) -> Response:
        if settings.metrics_token:
            supplied = request.headers.get("Authorization", "").removeprefix("Bearer ")
            if not secrets.compare_digest(supplied, settings.metrics_token):
                return problem(401, "Metrics token required")
        return Response(generate_latest(metrics.registry), media_type=CONTENT_TYPE_LATEST)


def init_error_tracking(settings: Settings) -> bool:
    """Starts Sentry when SENTRY_DSN is set. Request bodies and user emails are not sent (send_default_pii=False)."""
    if not settings.sentry_dsn:
        return False
    import sentry_sdk

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        send_default_pii=False,
    )
    log.info("error_tracking_enabled", provider="sentry")
    return True
