from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration from environment variables (or backend/.env).

    Missing required values fail at startup rather than at first use.
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: Literal["development", "test", "staging", "production"] = "development"
    database_url: PostgresDsn = Field(description="postgresql+asyncpg://user:password@host:port/database")
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    log_json: bool = True
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:8080"])
    # Supabase Auth. Tokens are verified with the project's JWKS (asymmetric signing keys); projects still on the
    # legacy shared secret set SUPABASE_JWT_SECRET instead.
    supabase_url: str | None = None
    supabase_jwt_secret: str | None = None
    supabase_jwt_audience: str = "authenticated"
    # Server-side Supabase key for Storage (signed uploads, deletes). Never sent to browsers.
    supabase_service_role_key: str | None = None
    profile_images_bucket: str = "profile-images"
    chat_media_bucket: str = "chat-media"
    # AI companion (OpenAI-compatible Chat Completions). Without a key the companion endpoints answer 503.
    llm_api_key: str | None = None
    llm_model: str = "gpt-4o-mini"
    llm_base_url: str = "https://api.openai.com/v1"
    companion_messages_per_hour: int = 30
    # Google Calendar. Without these the calendar endpoints answer 503.
    google_client_id: str | None = None
    google_client_secret: str | None = None
    # Must exactly match an authorised redirect URI in the Google Cloud console, e.g. https://app.example/calendar/callback
    google_redirect_uri: str | None = None
    # Fernet key (base64, 32 bytes) used to encrypt stored refresh tokens.
    token_encryption_key: str | None = None
    # Secret for signing OAuth state values; falls back to the token key.
    oauth_state_secret: str | None = None
    rate_limit_enabled: bool = True
    max_request_bytes: int = 1_000_000  # JSON bodies only; files go straight to storage
    db_pool_size: int = 5
    db_pool_timeout_seconds: float = 5.0

    @model_validator(mode="after")
    def _production_cors(self) -> "Settings":
        if self.environment == "production" and any(
            "*" in o or not o.startswith("https://") for o in self.cors_origins
        ):
            raise ValueError("In production CORS_ORIGINS must list explicit https:// origins")
        return self

    @model_validator(mode="after")
    def _require_auth_settings(self) -> "Settings":
        if not self.supabase_url and not self.supabase_jwt_secret:
            raise ValueError("Set SUPABASE_URL (JWKS verification) or SUPABASE_JWT_SECRET (legacy HS256)")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()  # values come from the environment
