#!/usr/bin/env bash
# Runs the Playwright end-to-end tests against a real local stack:
#   Supabase CLI (Auth with Mailpit, Storage, Postgres + supabase/migrations) → Love Islander API → web dev server.
# Usage: scripts/e2e.sh [playwright args]     KEEP_STACK=1 leaves everything running afterwards.
set -euo pipefail
cd "$(dirname "$0")/.."
SUPABASE="npx --yes supabase@2.120.0"
WEB_PORT=8080
API_PORT=8001
pids=()

cleanup() {
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  if [[ "${KEEP_STACK:-0}" != "1" ]]; then $SUPABASE stop --no-backup >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT

$SUPABASE start -x studio,imgproxy,edge-runtime,logflare,vector,realtime,supavisor,postgres-meta >/dev/null
eval "$($SUPABASE status -o env | sed 's/^/export SB_/')"

export E2E_SUPABASE_URL="$SB_API_URL" E2E_SUPABASE_ANON_KEY="$SB_ANON_KEY" E2E_SUPABASE_SERVICE_ROLE_KEY="$SB_SERVICE_ROLE_KEY"
export E2E_MAILPIT_URL="${SB_MAILPIT_URL:-$SB_INBUCKET_URL}" E2E_API_URL="http://127.0.0.1:$API_PORT" E2E_WEB_URL="http://localhost:$WEB_PORT"

(
  cd backend
  export DATABASE_URL="${SB_DB_URL/postgresql:/postgresql+asyncpg:}" SUPABASE_URL="$SB_API_URL" \
    SUPABASE_JWT_SECRET="$SB_JWT_SECRET" SUPABASE_SERVICE_ROLE_KEY="$SB_SERVICE_ROLE_KEY" \
    CORS_ORIGINS="[\"http://localhost:$WEB_PORT\"]" LOG_JSON=false RATE_LIMIT_ENABLED=false
  uv run alembic stamp head >/dev/null
  exec uv run uvicorn app.main:create_app --factory --port "$API_PORT"
) > /tmp/love-islander-e2e-api.log 2>&1 &
pids+=($!)

VITE_SUPABASE_URL="$SB_API_URL" VITE_SUPABASE_PUBLISHABLE_KEY="$SB_ANON_KEY" VITE_API_URL="http://127.0.0.1:$API_PORT" \
  npx vite --port "$WEB_PORT" --strictPort > /tmp/love-islander-e2e-web.log 2>&1 &
pids+=($!)

for url in "http://127.0.0.1:$API_PORT/readyz" "http://localhost:$WEB_PORT/"; do
  for _ in $(seq 1 60); do curl -fsS "$url" >/dev/null 2>&1 && break; sleep 1; done
  curl -fsS "$url" >/dev/null || { echo "Not ready: $url"; tail -50 /tmp/love-islander-e2e-api.log; exit 1; }
done

npx playwright test "$@"
