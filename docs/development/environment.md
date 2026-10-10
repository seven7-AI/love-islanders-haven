# Environment variables

## Web app (build time; embedded in the browser bundle — never put secrets here)
| Variable | Required | Example | Purpose |
|---|---|---|---|
| `VITE_SUPABASE_URL` | yes | `https://<ref>.supabase.co` | Supabase project (auth, signed uploads) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | yes | `sb_publishable_…` or anon key | Public client key |
| `VITE_API_URL` | yes | `https://api.example.com` | Love Islander API base URL |

Web container (runtime): `API_ORIGIN`, `SUPABASE_ORIGIN` — origins allowed by the Content-Security-Policy.

## API (`backend/`, runtime)
Read by `backend/app/core/config.py`; missing required values stop the API at startup.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | – | `postgresql+asyncpg://…`; use a direct connection, not a transaction pooler |
| `ENVIRONMENT` | no | `development` | `development`, `test`, `staging`, `production` (production hides `/docs`, enables HSTS and requires https CORS origins) |
| `LOG_LEVEL` | no | `INFO` | |
| `LOG_JSON` | no | `true` | JSON logs; set `false` for readable local output |
| `CORS_ORIGINS` | in production | `["http://localhost:8080"]` | JSON list of allowed browser origins |
| `SUPABASE_URL` | one of these two | – | Supabase project URL; access tokens are verified against `<url>/auth/v1/.well-known/jwks.json` (signature, `exp`, `aud`, `iss`) |
| `SUPABASE_JWT_SECRET` | one of these two | – | Legacy HS256 secret for projects without asymmetric signing keys |
| `SUPABASE_JWT_AUDIENCE` | no | `authenticated` | |
| `SUPABASE_SERVICE_ROLE_KEY` | for photos and chat media | – | Secret server-side key for Supabase Storage (signed uploads, existence checks, deletes). Without it photo endpoints return 503 `storage_not_configured` |
| `PROFILE_IMAGES_BUCKET` | no | `profile-images` | |
| `CHAT_MEDIA_BUCKET` | no | `chat-media` | Private bucket; media is served through signed URLs valid for one hour |
| `LLM_API_KEY` | for the AI companion | – | Secret key for an OpenAI-compatible Chat Completions API. Without it the companion endpoints return 503 `ai_not_configured` |
| `LLM_MODEL` | no | `gpt-4o-mini` | |
| `LLM_BASE_URL` | no | `https://api.openai.com/v1` | Any OpenAI-compatible endpoint |
| `COMPANION_MESSAGES_PER_HOUR` | no | `30` | Per-user limit |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | for Google Calendar | – | OAuth client (Google Cloud console). Without them calendar endpoints return 503 `calendar_not_configured` |
| `GOOGLE_REDIRECT_URI` | for Google Calendar | – | `https://<web-app>/calendar/callback`; must be registered on the OAuth client |
| `TOKEN_ENCRYPTION_KEY` | for Google Calendar | – | Fernet key for stored refresh tokens: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`. Rotating it disconnects existing calendars |
| `OAUTH_STATE_SECRET` | no | token key | Signs OAuth state values (10-minute lifetime, bound to the user) |
| `PEXELS_API_KEY` (or `PEXEL_API_KEY`) | for the seed tool | – | Pexels API key used only by the local seed tool to fetch stock photos (secret; never used by the running API or sent to browsers) |
| `METRICS_TOKEN` | recommended in production | – | Protects `/metrics` (Bearer token) |
| `SENTRY_DSN` / `SENTRY_TRACES_SAMPLE_RATE` | no | – / `0` | Error tracking; see [observability](../operations/observability.md) |
| `RATE_LIMIT_ENABLED` | no | `true` | Per-user limits on write endpoints |
| `MAX_REQUEST_BYTES` | no | `1000000` | Maximum JSON request body; files go straight to Storage |
| `DB_POOL_SIZE` | no | `5` | |
| `DB_POOL_TIMEOUT_SECONDS` | no | `5` | Connection and pool checkout timeout |

Templates: `web/.env.example` (web; Vite reads `web/.env`) and `backend/.env.example` (API). Real values live in the hosting platform's secret
store; `.env` files are git-ignored.
