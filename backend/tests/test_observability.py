import json
import uuid

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings
from app.core.observability import init_error_tracking
from app.main import create_app
from tests.conftest import auth_headers, make_settings
from tests.fakes import FakeStorage
from tests.test_discovery import person


async def test_metrics_use_route_templates(client: AsyncClient, app: FastAPI) -> None:
    me = await person(app)
    for _ in range(2):
        await client.get(f"/v1/matches/{uuid.uuid4()}/messages", headers=auth_headers(me))
    await client.get("/healthz")
    body = (await client.get("/metrics")).text
    assert 'http_requests_total{method="GET",route="/v1/matches/{match_id}/messages",status="404"} 2.0' in body
    assert 'route="/healthz"' in body
    assert "http_request_duration_seconds_bucket" in body
    # Raw ids never become label values.
    assert "/v1/matches/" + "0" * 8 not in body


async def test_metrics_token(settings: Settings, storage) -> None:  # type: ignore[no-untyped-def]
    app = create_app(settings.model_copy(update={"metrics_token": "s3cret"}), storage=storage)
    async with (
        app.router.lifespan_context(app),
        AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c,
    ):
        assert (await c.get("/metrics")).status_code == 401
        assert (await c.get("/metrics", headers={"Authorization": "Bearer wrong"})).status_code == 401
        assert (await c.get("/metrics", headers={"Authorization": "Bearer s3cret"})).status_code == 200


async def test_logs_carry_request_and_user_ids(
    settings: Settings,
    storage: FakeStorage,
    capfd: pytest.CaptureFixture[str],
) -> None:
    app = create_app(settings.model_copy(update={"log_level": "INFO", "log_json": True}), storage=storage)
    async with (
        app.router.lifespan_context(app),
        AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c,
    ):
        me = await person(app)
        await c.get("/v1/me", headers={**auth_headers(me), "X-Request-ID": "req-123"})
    lines = [json.loads(line) for line in capfd.readouterr().out.splitlines() if line.startswith("{")]
    request_log = next(e for e in lines if e.get("event") == "request" and e.get("path") == "/v1/me")
    assert request_log["request_id"] == "req-123"
    assert request_log["user_id"] == str(me)
    assert request_log["status"] == 200


def test_error_tracking_is_off_without_dsn() -> None:
    assert init_error_tracking(make_settings()) is False


def test_error_tracking_starts_with_dsn(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict[str, object]] = []
    monkeypatch.setattr("sentry_sdk.init", lambda **kw: calls.append(kw))
    assert init_error_tracking(make_settings(sentry_dsn="https://key@sentry.example/1")) is True
    assert calls[0]["send_default_pii"] is False
