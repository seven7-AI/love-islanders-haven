# Environment variables

## Web app (build time; embedded in the browser bundle — never put secrets here)
| Variable | Required | Example | Purpose |
|---|---|---|---|
| `VITE_SUPABASE_URL` | yes | `https://<ref>.supabase.co` | Supabase project (auth, signed uploads) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | yes | `sb_publishable_…` or anon key | Public client key |
| `VITE_API_URL` | yes | `https://api.example.com` | Love Islander API base URL |

Web container (runtime): `API_ORIGIN`, `SUPABASE_ORIGIN` — origins allowed by the Content-Security-Policy.

## API (`backend/`, runtime)
| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | – | `postgresql+asyncpg://…` (use the direct connection, not a transaction pooler) |
| `ENVIRONMENT` | no | `development` | `production` hides `/docs`, enables HSTS, requires https CORS origins |
| `CORS_ORIGINS` | prod: yes | `["http://localhost:8080"]` | JSON list of web origins |
| `SUPABASE_URL` | one of two | – | Token verification via JWKS; Storage base URL |
| `SUPABASE_JWT_SECRET` | one of two | – | Legacy HS256 token verification |
| `SUPABASE_JWT_AUDIENCE` | no | `authenticated` | |
| `SUPABASE_SERVICE_ROLE_KEY` | for photos/chat media | – | Server-side Storage access (secret) |
| `PROFILE_IMAGES_BUCKET` / `CHAT_MEDIA_BUCKET` | no | `profile-images` / `chat-media` | |
| `LLM_API_KEY` | for AI companion | – | OpenAI-compatible key (secret) |
| `LLM_MODEL` / `LLM_BASE_URL` | no | `gpt-4o-mini` / OpenAI | |
| `COMPANION_MESSAGES_PER_HOUR` | no | `30` | |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | for Google Calendar | – | OAuth client; redirect `https://<web>/calendar/callback` |
| `TOKEN_ENCRYPTION_KEY` | for Google Calendar | – | Fernet key (secret) |
| `OAUTH_STATE_SECRET` | no | token key | |
| `METRICS_TOKEN` | recommended | – | Protects `/metrics` |
| `SENTRY_DSN` / `SENTRY_TRACES_SAMPLE_RATE` | no | – / `0` | Error tracking |
| `RATE_LIMIT_ENABLED` | no | `true` | |
| `MAX_REQUEST_BYTES` | no | `1000000` | |
| `LOG_LEVEL` / `LOG_JSON` | no | `INFO` / `true` | |
| `DB_POOL_SIZE` / `DB_POOL_TIMEOUT_SECONDS` | no | `5` / `5` | |

Templates: `.env.example` (web) and `backend/.env.example` (API). Real values live in the hosting platform's secret
store; `.env` files are git-ignored.
