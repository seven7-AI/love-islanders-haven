from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    calendar,
    companion,
    discovery,
    health,
    insights,
    me,
    messages,
    notifications,
    profiles,
    safety,
    streaks,
)
from app.core.config import Settings, get_settings
from app.core.errors import register_error_handlers
from app.core.logging import configure_logging
from app.core.middleware import BodySizeLimitMiddleware, RequestContextMiddleware, SecurityHeadersMiddleware
from app.core.rate_limit import SlidingWindowLimiter
from app.db.session import Database, create_engine
from app.integrations.alerts import AlertSender, UnconfiguredAlertSender
from app.integrations.auth import SupabaseTokenVerifier, TokenVerifier
from app.integrations.google import GoogleCalendarClient
from app.integrations.llm import LLMProvider, OpenAICompatibleLLM, UnconfiguredLLM
from app.integrations.storage import StorageProvider, SupabaseStorage
from app.integrations.storage.provider import UnconfiguredStorage
from app.services.calendar import build_config as build_calendar_config


def create_app(
    settings: Settings | None = None,
    *,
    token_verifier: TokenVerifier | None = None,
    storage: StorageProvider | None = None,
    alert_sender: AlertSender | None = None,
    llm: LLMProvider | None = None,
    google_client: GoogleCalendarClient | None = None,
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
    app.state.alert_sender = alert_sender or UnconfiguredAlertSender()
    app.state.llm = llm or _default_llm(settings)
    app.state.calendar = build_calendar_config(settings, google_client)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )
    app.add_middleware(SecurityHeadersMiddleware, hsts=settings.environment == "production")
    app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.max_request_bytes)
    app.add_middleware(RequestContextMiddleware)
    app.state.rate_limiter = SlidingWindowLimiter()
    register_error_handlers(app)
    app.include_router(health.router)
    app.include_router(me.router)
    app.include_router(profiles.router)
    app.include_router(discovery.router)
    app.include_router(messages.router)
    app.include_router(streaks.router)
    app.include_router(safety.router)
    app.include_router(notifications.router)
    app.include_router(companion.router)
    app.include_router(calendar.router)
    app.include_router(insights.router)
    return app


def _default_storage(settings: Settings) -> StorageProvider:
    if settings.supabase_url and settings.supabase_service_role_key:
        return SupabaseStorage(settings.supabase_url, settings.supabase_service_role_key)
    return UnconfiguredStorage()


def _default_llm(settings: Settings) -> LLMProvider:
    if settings.llm_api_key:
        return OpenAICompatibleLLM(settings.llm_api_key, settings.llm_model, settings.llm_base_url)
    return UnconfiguredLLM()
