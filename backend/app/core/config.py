from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn
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
    db_pool_size: int = 5
    db_pool_timeout_seconds: float = 5.0


@lru_cache
def get_settings() -> Settings:
    return Settings()  # values come from the environment
