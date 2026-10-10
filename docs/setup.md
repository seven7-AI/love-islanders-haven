# Local setup (from a fresh clone)

Requirements: Git, Node.js 22 + npm, Python 3.12 with [uv](https://docs.astral.sh/uv/), Docker, `psql` (for the
database scripts). No Lovable tooling is used.

```bash
git clone <repo-url> love-islanders-haven && cd love-islanders-haven
npm ci
(cd backend && uv sync)
```

## Option A — everything local (recommended)
Runs a local Postgres (schema from Alembic), a local Supabase (Auth, Storage), the API and the web app:
```bash
KEEP_STACK=1 npm run test:e2e      # first run downloads images; leaves the stack running
npx supabase@2.120.0 status -o env # shows the local URLs and keys
```
Then start the application database, the API and the web app (values from `status`):
```bash
make migrate       # Postgres 16 on localhost:5433, schema via alembic upgrade head
cd backend
DATABASE_URL=postgresql+asyncpg://postgres:postgres@127.0.0.1:5433/love_islander \
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY> \
CORS_ORIGINS='["http://localhost:8080"]' LOG_JSON=false \
uv run uvicorn app.main:create_app --factory --reload --port 8001
# another terminal, repository root:
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY> VITE_API_URL=http://127.0.0.1:8001 npm run dev
```
Sign-up confirmation emails appear in Mailpit at http://127.0.0.1:54324.

## Option B — API and database only
```bash
make db            # Postgres 16 on localhost:5433
make migrate       # alembic upgrade head
cp backend/.env.example backend/.env   # set SUPABASE_URL or SUPABASE_JWT_SECRET
cd backend && uv run uvicorn app.main:create_app --factory --reload
```

## Checks
```bash
make check   # web + API checks
make ci      # everything CI runs, including database policy and end-to-end tests
```
See `docs/testing.md`.
