# Love Islander API

FastAPI service that will own the app's business logic and data (see `docs/STATUS.md` for which features have moved).

## Layout
- `app/main.py` – `create_app()` factory: settings, logging, middleware, error handlers, routers
- `app/core/` – configuration (`pydantic-settings`), structured logging (`structlog`), RFC 9457 problem responses, request-id middleware
- `app/db/` – async SQLAlchemy engine/session
- `app/api/` – routers and dependencies (`/healthz` liveness, `/readyz` database readiness, `/v1/me`)
- `app/integrations/auth/` – `TokenVerifier` interface and the Supabase implementation. Endpoints get the user from
  `CurrentUser` (the verified token's `sub`); request bodies never carry user ids.

## Run locally
```bash
make db                       # Postgres 16 on localhost:5433 (also creates love_islander_test)
cd backend && cp .env.example .env
uv sync
uv run uvicorn app.main:create_app --factory --reload
```
Or the whole stack in Docker: `make up` (API on `localhost:${API_PORT:-8000}`).

## Checks
```bash
make api-check                # ruff check, ruff format --check, mypy --strict, pytest (needs `make db`)
```
Auth tests use locally generated keys and a local JWKS endpoint (`tests/auth_helpers.py`) as a substitute for Supabase
Auth; they verify the API's token handling, not Supabase itself.
Tests use a real Postgres (`TEST_DATABASE_URL`, default `postgresql+asyncpg://postgres:postgres@localhost:5433/love_islander_test`).

## Configuration
| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | – | `postgresql+asyncpg://…` |
| `ENVIRONMENT` | no | `development` | `development`, `test`, `staging`, `production` (production hides `/docs`) |
| `LOG_LEVEL` | no | `INFO` | |
| `LOG_JSON` | no | `true` | JSON logs; set `false` for readable local output |
| `CORS_ORIGINS` | no | `["http://localhost:8080"]` | JSON list of allowed browser origins |
| `SUPABASE_URL` | one of these two | – | Supabase project URL; access tokens are verified against `<url>/auth/v1/.well-known/jwks.json` (signature, `exp`, `aud`, `iss`) |
| `SUPABASE_JWT_SECRET` | one of these two | – | Legacy HS256 secret for projects without asymmetric signing keys |
| `SUPABASE_JWT_AUDIENCE` | no | `authenticated` | |
| `DB_POOL_SIZE` | no | `5` | |
| `DB_POOL_TIMEOUT_SECONDS` | no | `5` | Connection and pool checkout timeout |
