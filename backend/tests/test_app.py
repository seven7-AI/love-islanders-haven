import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from app.core.config import Settings
from app.core.errors import AppError
from app.main import create_app
from tests.conftest import make_settings


async def test_liveness(client: AsyncClient) -> None:
    response = await client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_readiness_checks_the_database(client: AsyncClient) -> None:
    response = await client.get("/readyz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


async def test_readiness_fails_when_database_is_unreachable() -> None:
    app = create_app(
        make_settings(
            database_url="postgresql+asyncpg://postgres:postgres@127.0.0.1:1/none", db_pool_timeout_seconds=1
        )
    )
    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/readyz")
    assert response.status_code == 503
    assert response.json()["database"] == "unreachable"


async def test_request_id_is_generated(client: AsyncClient) -> None:
    response = await client.get("/healthz")
    assert len(response.headers["X-Request-ID"]) == 32


async def test_valid_request_id_is_propagated(client: AsyncClient) -> None:
    response = await client.get("/healthz", headers={"X-Request-ID": "abc-123"})
    assert response.headers["X-Request-ID"] == "abc-123"


async def test_unsafe_request_id_is_replaced(client: AsyncClient) -> None:
    response = await client.get("/healthz", headers={"X-Request-ID": "bad id\nInjected: 1"})
    assert response.headers["X-Request-ID"] != "bad id\nInjected: 1"


async def test_unknown_route_returns_problem_json(client: AsyncClient) -> None:
    response = await client.get("/nope")
    assert response.status_code == 404
    assert response.headers["content-type"] == "application/problem+json"
    assert response.json()["status"] == 404


async def test_app_errors_and_unexpected_errors_are_problem_json() -> None:
    app = create_app(make_settings())

    @app.get("/boom-expected")
    async def expected() -> None:
        raise AppError(409, "Already exists", code="conflict")

    @app.get("/boom-unexpected")
    async def unexpected() -> None:
        raise RuntimeError("secret internal detail")

    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with (
        app.router.lifespan_context(app),
        AsyncClient(transport=transport, base_url="http://t") as client,
    ):
        expected_response = await client.get("/boom-expected")
        unexpected_response = await client.get("/boom-unexpected")

    assert expected_response.status_code == 409
    assert expected_response.json() == {
        "type": "about:blank",
        "title": "Conflict",
        "status": 409,
        "detail": "Already exists",
        "code": "conflict",
    }
    assert unexpected_response.status_code == 500
    assert "secret" not in unexpected_response.text


def test_settings_require_database_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(ValidationError):
        Settings(_env_file=None)
