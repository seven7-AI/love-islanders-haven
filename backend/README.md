# Love Islander API

FastAPI service that will own the app's business logic and data (see `docs/STATUS.md` for which features have moved).

## Layout
- `app/main.py` – `create_app()` factory: settings, logging, middleware, error handlers, routers
- `app/core/` – configuration (`pydantic-settings`), structured logging (`structlog`), RFC 9457 problem responses, request-id middleware
- `app/db/` – async SQLAlchemy engine/session
- `app/api/` – routers and dependencies (`/healthz` liveness, `/readyz` database readiness, `/v1/me`)
- `app/integrations/storage/` – `StorageProvider` interface and the Supabase Storage implementation
- `app/services/profiles.py` – profile, onboarding and photo rules (18+, field validation, photo limits, ownership)
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

## Scheduled jobs
| Command | Schedule | Purpose |
|---|---|---|
| `python -m app.jobs.expire_streaks --retention-hours 24` | hourly | Deletes streak posts that expired more than the retention period ago, and their photos. Posts whose photos cannot be deleted are kept and retried on the next run. |

Run them with the same environment as the API (e.g. a cron job or the hosting platform's scheduler running the API image).

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
| `SUPABASE_SERVICE_ROLE_KEY` | for photos | – | Server-side key for Supabase Storage (signed uploads, existence checks, deletes). Without it photo endpoints return 503 `storage_not_configured` |
| `PROFILE_IMAGES_BUCKET` | no | `profile-images` | |
| `CHAT_MEDIA_BUCKET` | no | `chat-media` | Private bucket; media is served through signed URLs valid for one hour |
| `DB_POOL_SIZE` | no | `5` | |
| `DB_POOL_TIMEOUT_SECONDS` | no | `5` | Connection and pool checkout timeout |
