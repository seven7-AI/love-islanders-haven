# Love Islander API

FastAPI service that owns the app's business logic and data. Architecture overview: `docs/architecture.md`.

## Layout
- `app/main.py` – `create_app()` factory: settings, logging, middleware, error handlers, routers
- `app/core/` – configuration (`pydantic-settings`), structured logging (`structlog`), RFC 9457 problem responses,
  middleware (request ids, security headers, body limit), rate limits, metrics, encryption, cursor pagination
- `app/api/` – routers and dependencies (`/healthz`, `/readyz`, `/metrics`, `/v1/...`)
- `app/schemas/` – pydantic request and response models
- `app/services/` – business rules: profiles, discovery and matching, messaging, streaks, notifications, settings,
  safety, AI companion, calendar, insights
- `app/integrations/` – interfaces with their implementations: `auth` (Supabase token verification), `storage`
  (Supabase Storage), `llm` (OpenAI-compatible), `google` (OAuth and Calendar), `alerts` (delivery interface).
  Endpoints get the user from `CurrentUser` (the verified token's `sub`); request bodies never carry user ids.
- `app/db/` – async SQLAlchemy engine, session and models
- `app/jobs/` – scheduled commands (below)
- `alembic/` – schema migrations (the only schema authority; `docs/database/migrations.md`)

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

## Scheduled jobs
| Command | Schedule | Purpose |
|---|---|---|
| `python -m app.jobs.expire_streaks --retention-hours 24` | hourly | Deletes streak posts that expired more than the retention period ago, and their photos. Posts whose photos cannot be deleted are kept and retried on the next run. |
| `python -m app.jobs.companion_checkins --quiet-hours 48` | every few hours | Sends a short AI companion check-in to users who enabled proactive messages and have not chatted recently. Does nothing without `LLM_API_KEY`. |

Run them with the same environment as the API (e.g. a cron job or the hosting platform's scheduler running the API image).

## Configuration
All settings are environment variables (or `backend/.env`, from `backend/.env.example`); the reference is
[docs/development/environment.md](../docs/development/environment.md).
