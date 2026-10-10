#!/usr/bin/env bash
# Runs the Playwright end-to-end tests against a real local stack:
#   Postgres (schema from Alembic) → Love Islander API → web dev server, with the Supabase CLI providing only Auth
#   (with Mailpit) and Storage.
# Usage: scripts/e2e.sh [playwright args]     KEEP_STACK=1 leaves everything running afterwards.
set -euo pipefail
cd "$(dirname "$0")/.."
SUPABASE="npx --yes supabase@2.120.0"
WEB_PORT=8080
API_PORT=8001
DB_CONTAINER=love-islander-e2e-db
POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:16-alpine}"
pids=()

cleanup() {
  # Each server runs in its own process group (set -m below), so this also stops children such as Vite under npm.
  for pid in "${pids[@]}"; do kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true; done
  if [[ "${KEEP_STACK:-0}" != "1" ]]; then
    $SUPABASE stop --no-backup >/dev/null 2>&1 || true
    docker rm -f "$DB_CONTAINER" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

# A server left over from an earlier run would answer the readiness checks below and be tested instead.
for port in "$WEB_PORT" "$API_PORT"; do
  if curl -s -o /dev/null "http://localhost:$port/"; then echo "Port $port is already in use; stop that process first." >&2; exit 1; fi
done

# The application database: a fresh Postgres whose schema is created by the Alembic migrations.
docker rm -f "$DB_CONTAINER" >/dev/null 2>&1 || true
for attempt in 1 2 3 4 5; do
  docker image inspect "$POSTGRES_IMAGE" >/dev/null 2>&1 && break
  docker pull -q "$POSTGRES_IMAGE" >/dev/null 2>&1 && break
  echo "Pulling $POSTGRES_IMAGE failed (attempt $attempt); retrying" >&2
  sleep $((attempt * 5))
done
docker run -d --name "$DB_CONTAINER" -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=love_islander \
  -p 127.0.0.1::5432 "$POSTGRES_IMAGE" >/dev/null
DB_PORT="$(docker port "$DB_CONTAINER" 5432/tcp | head -1 | cut -d: -f2)"
for _ in $(seq 1 30); do docker exec "$DB_CONTAINER" pg_isready -q -U postgres -d love_islander && break; sleep 1; done
export DATABASE_URL="postgresql+asyncpg://postgres:postgres@127.0.0.1:$DB_PORT/love_islander"
(cd backend && uv run alembic upgrade head)

$SUPABASE start -x studio,imgproxy,edge-runtime,logflare,vector,realtime,supavisor,postgres-meta >/dev/null
eval "$($SUPABASE status -o env | sed 's/^/export SB_/')"

export E2E_SUPABASE_URL="$SB_API_URL" E2E_SUPABASE_ANON_KEY="$SB_ANON_KEY" E2E_SUPABASE_SERVICE_ROLE_KEY="$SB_SERVICE_ROLE_KEY"
export E2E_MAILPIT_URL="${SB_MAILPIT_URL:-$SB_INBUCKET_URL}" E2E_API_URL="http://127.0.0.1:$API_PORT" E2E_WEB_URL="http://localhost:$WEB_PORT"

set -m # background jobs get their own process groups (see cleanup)
(
  cd backend
  export SUPABASE_URL="$SB_API_URL" \
    SUPABASE_JWT_SECRET="$SB_JWT_SECRET" SUPABASE_SERVICE_ROLE_KEY="$SB_SERVICE_ROLE_KEY" \
    CORS_ORIGINS="[\"http://localhost:$WEB_PORT\"]" LOG_JSON=false RATE_LIMIT_ENABLED=false
  exec uv run uvicorn app.main:create_app --factory --port "$API_PORT"
) > /tmp/love-islander-e2e-api.log 2>&1 &
pids+=($!)

VITE_SUPABASE_URL="$SB_API_URL" VITE_SUPABASE_PUBLISHABLE_KEY="$SB_ANON_KEY" VITE_API_URL="http://127.0.0.1:$API_PORT" \
  npm run dev -w web -- --port "$WEB_PORT" --strictPort > /tmp/love-islander-e2e-web.log 2>&1 &
pids+=($!)
set +m

for url in "http://127.0.0.1:$API_PORT/readyz" "http://localhost:$WEB_PORT/"; do
  for _ in $(seq 1 60); do curl -fsS "$url" >/dev/null 2>&1 && break; sleep 1; done
  curl -fsS "$url" >/dev/null || {
    echo "Not ready: $url"; tail -30 /tmp/love-islander-e2e-api.log /tmp/love-islander-e2e-web.log; exit 1; }
done

npm test -w e2e -- "$@"
