import asyncio
import os
from collections.abc import AsyncIterator

import pytest
from alembic.config import Config
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from alembic import command
from app.core.config import Settings
from app.db.models import Base
from app.main import create_app
from tests.auth_helpers import HS_SECRET

# Integration tests use a real Postgres (docker compose service `db`, or the CI service container).
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5433/love_islander_test"
)


def make_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "environment": "test",
        "database_url": TEST_DATABASE_URL,
        "log_json": False,
        "log_level": "WARNING",
        "supabase_jwt_secret": HS_SECRET,
    }
    values.update(overrides)
    return Settings.model_validate(values)


@pytest.fixture
def settings() -> Settings:
    return make_settings()


@pytest.fixture
async def app(settings: Settings) -> AsyncIterator[FastAPI]:
    application = create_app(settings)
    async with application.router.lifespan_context(application):
        yield application


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    async with AsyncClient(transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test") as c:
        yield c


@pytest.fixture(scope="session", autouse=True)
async def migrated_test_database() -> None:
    """Bring the shared test database to the latest schema once per run."""
    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", TEST_DATABASE_URL)
    await asyncio.to_thread(command.upgrade, cfg, "head")


@pytest.fixture(autouse=True)
async def clean_tables(app: FastAPI) -> AsyncIterator[None]:
    """Each test starts and ends with empty application tables."""
    yield
    tables = ", ".join(t.name for t in Base.metadata.sorted_tables)
    async with app.state.db.engine.begin() as conn:
        await conn.exec_driver_sql(f"TRUNCATE {tables} CASCADE")
