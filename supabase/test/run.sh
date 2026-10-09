#!/usr/bin/env bash
# Apply supabase/migrations to a fresh Postgres with Supabase platform stubs and run the SQL policy tests.
#
# Usage:
#   supabase/test/run.sh                 # starts a throwaway postgres:15 container (needs Docker)
#   PGHOST=... PGUSER=... supabase/test/run.sh   # use an existing empty database instead (CI)
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
migrations="$here/../migrations"
container=""

cleanup() { [[ -n "$container" ]] && docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT

if [[ -z "${PGHOST:-}" ]]; then
  container="love-islander-policy-tests-$$"
  docker run -d --name "$container" -e POSTGRES_PASSWORD=postgres -p 127.0.0.1::5432 postgres:15-alpine >/dev/null
  export PGHOST=127.0.0.1 PGUSER=postgres PGPASSWORD=postgres PGDATABASE=postgres
  PGPORT="$(docker port "$container" 5432/tcp | head -1 | cut -d: -f2)"
  export PGPORT
  for _ in $(seq 1 30); do
    pg_isready -q && psql -qAtc 'select 1' >/dev/null 2>&1 && break
    sleep 1
  done
fi

export PGOPTIONS='-c client_min_messages=warning'
psql_run() { psql -v ON_ERROR_STOP=1 -q -X "$@"; }

echo "Bootstrapping Supabase stubs"
psql_run -f "$here/bootstrap.sql"

for f in "$migrations"/*.sql; do
  echo "Applying $(basename "$f")"
  if ! out="$(psql_run -f "$f" 2>&1)"; then
    echo "$out"
    echo "Migration failed: $f"
    exit 1
  fi
  # Publications warn when wal_level is not logical; irrelevant for these tests.
  echo "$out" | grep -v -e 'wal_level' -e '^$' || true
done

psql_run -f "$here/helpers.sql"

failed=0
for t in "$here"/tests/*.sql; do
  name="$(basename "$t")"
  # Each test file runs in one transaction that is rolled back, so tests are independent.
  if out="$( { echo 'BEGIN;'; cat "$t"; echo 'ROLLBACK;'; } | psql -v ON_ERROR_STOP=1 -q -X 2>&1)"; then
    echo "PASS $name"
  else
    echo "FAIL $name"
    echo "$out" | sed 's/^/    /'
    failed=1
  fi
done

exit "$failed"
