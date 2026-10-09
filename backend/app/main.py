from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import discovery, health, me, messages, profiles
from app.core.config import Settings, get_settings
from app.core.errors import register_error_handlers
from app.core.logging import configure_logging
from app.core.middleware import RequestContextMiddleware
from app.db.session import Database, create_engine
from app.integrations.auth import SupabaseTokenVerifier, TokenVerifier
from app.integrations.storage import StorageProvider, SupabaseStorage
from app.integrations.storage.provider import UnconfiguredStorage


def create_app(
    settings: Settings | None = None,
    *,
    token_verifier: TokenVerifier | None = None,
    storage: StorageProvider | None = None,
) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level, settings.log_json)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.db = Database(create_engine(settings))
        yield
        await app.state.db.dispose()

    app = FastAPI(
        title="Love Islander API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.environment != "production" else None,
        redoc_url=None,
    )
    app.state.settings = settings
    app.state.token_verifier = token_verifier or SupabaseTokenVerifier(
        supabase_url=settings.supabase_url,
        jwt_secret=settings.supabase_jwt_secret,
        audience=settings.supabase_jwt_audience,
    )
    app.state.storage = storage or _default_storage(settings)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )
    app.add_middleware(RequestContextMiddleware)
    register_error_handlers(app)
    app.include_router(health.router)
    app.include_router(me.router)
    app.include_router(profiles.router)
    app.include_router(discovery.router)
    app.include_router(messages.router)
    return app


def _default_storage(settings: Settings) -> StorageProvider:
    if settings.supabase_url and settings.supabase_service_role_key:
        return SupabaseStorage(settings.supabase_url, settings.supabase_service_role_key)
    return UnconfiguredStorage()
