import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from pydantic import ValidationError

from app.core.config import Settings
from app.core.rate_limit import SlidingWindowLimiter
from tests.conftest import auth_headers, make_settings
from tests.test_discovery import person


def test_sliding_window() -> None:
    limiter = SlidingWindowLimiter()
    key = ("g", "u")
    assert [limiter.hit(key, 2, 60, now=t) for t in (0, 1)] == [None, None]
    assert limiter.hit(key, 2, 60, now=2) == pytest.approx(58)
    assert limiter.hit(key, 2, 60, now=61) is None  # the first hit has left the window
    assert limiter.hit(("g", "other"), 2, 60, now=2) is None  # per user


async def test_rate_limited_endpoint_returns_429_with_retry_after(client: AsyncClient, app: FastAPI) -> None:
    me = await person(app)
    await client.post("/v1/safety-contacts", headers=auth_headers(me), json={"name": "Mum", "phone": "123456"})
    statuses = [
        (await client.post("/v1/safety/alerts", headers=auth_headers(me), json={})).status_code for _ in range(4)
    ]
    assert statuses == [503, 503, 503, 429]
    limited = await client.post("/v1/safety/alerts", headers=auth_headers(me), json={})
    assert limited.json()["code"] == "rate_limited"
    assert int(limited.headers["Retry-After"]) >= 1
    # Another user is unaffected.
    other = await person(app)
    await client.post("/v1/safety-contacts", headers=auth_headers(other), json={"name": "Mum", "phone": "123456"})
    assert (await client.post("/v1/safety/alerts", headers=auth_headers(other), json={})).status_code == 503


async def test_security_headers(client: AsyncClient, app: FastAPI) -> None:
    me = await person(app)
    response = await client.get("/v1/me", headers=auth_headers(me))
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Content-Security-Policy"] == "default-src 'none'; frame-ancestors 'none'"
    assert response.headers["Cache-Control"] == "no-store"
    assert "Strict-Transport-Security" not in response.headers  # only in production


async def test_oversized_bodies_are_rejected(client: AsyncClient, app: FastAPI) -> None:
    me = await person(app)
    response = await client.post(
        "/v1/feedback", headers=auth_headers(me), content=b"x" * 1_000_001, params={}, extensions={}
    )
    assert response.status_code == 413


async def test_cors_allows_only_configured_origins(client: AsyncClient) -> None:
    allowed = await client.options(
        "/v1/me", headers={"Origin": "http://localhost:8080", "Access-Control-Request-Method": "GET"}
    )
    assert allowed.headers.get("access-control-allow-origin") == "http://localhost:8080"
    denied = await client.options(
        "/v1/me", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"}
    )
    assert "access-control-allow-origin" not in denied.headers


@pytest.mark.parametrize("origins", [["*"], ["http://app.example"]])
def test_production_requires_explicit_https_origins(origins: list[str]) -> None:
    with pytest.raises(ValidationError):
        make_settings(environment="production", cors_origins=origins)


def test_production_settings_accept_https_origins() -> None:
    origins = ["https://app.example", "https://localhost", "capacitor://localhost"]
    settings: Settings = make_settings(environment="production", cors_origins=origins)
    assert settings.cors_origins == origins


def test_configuration_errors_do_not_echo_values() -> None:
    """A startup failure is logged; it must not carry secrets such as the database password or API keys."""
    with pytest.raises(ValidationError) as error:
        make_settings(
            environment="production",
            cors_origins=["*"],
            llm_api_key="sk-do-not-print",
            supabase_jwt_secret="jwt-do-not-print",
        )
    assert "do-not-print" not in str(error.value)
