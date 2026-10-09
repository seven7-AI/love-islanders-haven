#!/usr/bin/env bash
# Drill for copy-data.sh: a database built from supabase/migrations (with the Supabase stubs) is seeded and its data
# copied into a fresh Alembic database, then validated. Proves the two schemas are data-compatible.
# Usage: scripts/db/copy-drill.sh <postgres-url-of-server>   (superuser; e.g. .../postgres)
set -euo pipefail
admin="${1:?usage: copy-drill.sh <postgres-url>}"
here="$(cd "$(dirname "$0")" && pwd)"
root="$here/../.."
suffix="$(date +%s)$$"
src_db="copy_src_$suffix"; dst_db="copy_dst_$suffix"
base="${admin%/*}"
src="$base/$src_db"; dst="$base/$dst_db"

cleanup() {
  psql "$admin" -qX -c "drop database if exists $src_db with (force)" -c "drop database if exists $dst_db with (force)" >/dev/null
}
trap cleanup EXIT

psql "$admin" -qX -c "create database $src_db" -c "create database $dst_db"

export PGOPTIONS='-c client_min_messages=error'
psql "$src" -qX -v ON_ERROR_STOP=1 -f "$root/supabase/test/bootstrap.sql" >/dev/null
for f in "$root"/supabase/migrations/*.sql; do psql "$src" -qX -v ON_ERROR_STOP=1 -f "$f" >/dev/null; done
# Auth users for the sample profiles; seed with triggers suspended so rows load exactly as given.
{
  echo "SET session_replication_role = replica;"
  echo "INSERT INTO auth.users (id, email) SELECT id::uuid, 'user' || n || '@example.com' FROM (VALUES
    ('11111111-1111-1111-1111-111111111111', 1), ('22222222-2222-2222-2222-222222222222', 2),
    ('33333333-3333-3333-3333-333333333333', 3)) v(id, n);"
  cat "$here/seed-sample.sql"
} | psql "$src" -qX -v ON_ERROR_STOP=1 >/dev/null
unset PGOPTIONS

(cd "$root/backend" && DATABASE_URL="${dst/postgresql:/postgresql+asyncpg:}" uv run alembic upgrade head >/dev/null)
"$here/copy-data.sh" "$src" "$dst"
echo "Copy drill passed"
