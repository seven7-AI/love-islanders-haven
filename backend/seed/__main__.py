"""Command line: `uv run python -m seed run|verify|reset` (from backend/). See docs/development/seed-data.md."""

import argparse
import asyncio
import sys
from typing import Literal
from urllib.parse import urlparse

from pydantic import AliasChoices, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

from seed.photos import PhotoSource
from seed.runner import Seeder, reset
from seed.stack import SeedError, Stack

LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "host.docker.internal"}


class SeedSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore", populate_by_name=True, hide_input_in_errors=True
    )

    environment: Literal["development", "test", "staging", "production"] = "development"
    api_url: str = Field(default="http://127.0.0.1:8001", validation_alias=AliasChoices("api_url", "SEED_API_URL"))
    supabase_url: str = "http://127.0.0.1:54321"
    supabase_anon_key: str = ""
    supabase_service_role_key: SecretStr = SecretStr("")
    database_url: str | None = None
    # Shared password of every seed account. Only for local and test stacks; never a real credential.
    seed_password: str = "LoveIsland-Seed-2026!"  # noqa: S105 - documented local-only test password
    # Without a Pexels key, generate plain placeholder images instead of failing (CI without the secret).
    seed_placeholder_photos: bool = False
    pexels_api_key: SecretStr | None = Field(
        default=None, validation_alias=AliasChoices("pexels_api_key", "PEXELS_API_KEY", "PEXEL_API_KEY")
    )


def refuse_unsafe(settings: SeedSettings, allow_remote: bool) -> str | None:
    """Why seeding this target is refused, or None when it is a local/test stack."""
    if settings.environment == "production":
        return "ENVIRONMENT=production: seed data is for local and test environments only"
    for name, url in (("SUPABASE_URL", settings.supabase_url), ("SEED_API_URL", settings.api_url)):
        host = urlparse(url).hostname or ""
        if host not in LOCAL_HOSTS and not allow_remote:
            return f"{name} points at {host!r}, not a local stack; pass --allow-remote for a dedicated test stack"
    return None


async def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="python -m seed", description="Seed accounts for local and test stacks.")
    parser.add_argument("command", choices=["run", "verify", "reset"])
    parser.add_argument("--allow-remote", action="store_true", help="allow a non-local (dedicated test) stack")
    args = parser.parse_args(argv)

    settings = SeedSettings()
    if reason := refuse_unsafe(settings, args.allow_remote):
        print(f"Refusing to seed: {reason}", file=sys.stderr)
        return 2
    if not settings.supabase_anon_key or not settings.supabase_service_role_key.get_secret_value():
        print("Set SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY (see `npx supabase status -o env`)", file=sys.stderr)
        return 2

    stack = Stack(
        settings.api_url,
        settings.supabase_url,
        settings.supabase_anon_key,
        settings.supabase_service_role_key.get_secret_value(),
    )
    photos = PhotoSource(
        settings.pexels_api_key.get_secret_value() if settings.pexels_api_key else None,
        placeholders=settings.seed_placeholder_photos,
    )
    try:
        if args.command == "reset":
            if not settings.database_url:
                print("reset needs DATABASE_URL (the API's database)", file=sys.stderr)
                return 2
            await reset(stack, settings.database_url)
            return 0
        seeder = Seeder(stack, photos, settings.seed_password, database_url=settings.database_url)
        if args.command == "run":
            await seeder.run()
            if photos.placeholders_used:
                print(f"note: {photos.placeholders_used} photos are generated placeholders, not Pexels photos")
            return 0
        problems = await seeder.verify()
        for problem in problems:
            print(f"FAIL {problem}")
        print("seed verified" if not problems else f"{len(problems)} problem(s)")
        return 1 if problems else 0
    except SeedError as exc:
        print(f"Seed failed: {exc}", file=sys.stderr)
        return 1
    finally:
        await photos.aclose()
        await stack.aclose()


if __name__ == "__main__":
    sys.exit(asyncio.run(main(sys.argv[1:])))
