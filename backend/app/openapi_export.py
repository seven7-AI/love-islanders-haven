"""Writes the API's OpenAPI document to stdout.

docs/api/openapi.json is generated with `make api-docs`; tests/test_openapi_docs.py fails when it is out of date.
The document depends only on the code, so the export uses fixed placeholder settings and never connects anywhere.
"""

import json
import sys
from typing import Any

from app.core.config import Settings
from app.main import create_app


def openapi_document() -> dict[str, Any]:
    settings = Settings(
        _env_file=None,
        environment="development",
        database_url="postgresql+asyncpg://openapi:openapi@localhost:5432/openapi",
        supabase_jwt_secret="openapi-export",  # noqa: S106 - placeholder; no token is ever verified
        log_json=False,
        sentry_dsn=None,
    )
    return create_app(settings).openapi()


def render() -> str:
    return json.dumps(openapi_document(), indent=2, ensure_ascii=False) + "\n"


if __name__ == "__main__":
    sys.stdout.write(render())
