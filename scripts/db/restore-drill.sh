#!/usr/bin/env bash
# End-to-end backup/restore drill on a disposable database:
#   create DB → alembic upgrade → seed → backup → restore into a second empty DB → validate → drop both.
# Usage: scripts/db/restore-drill.sh <postgres-url-of-server>   (any database on the server, e.g. .../postgres)
set -euo pipefail
admin="${1:?usage: restore-drill.sh <postgres-url>}"
here="$(cd "$(dirname "$0")" && pwd)"
root="$here/../.."
suffix="$(date +%s)$$"
src_db="drill_src_$suffix"; dst_db="drill_dst_$suffix"
base="${admin%/*}"
src="$base/$src_db"; dst="$base/$dst_db"
out="$(mktemp -d)"

cleanup() {
  psql "$admin" -qX -c "drop database if exists $src_db with (force)" -c "drop database if exists $dst_db with (force)" >/dev/null
  rm -rf "$out"
}
trap cleanup EXIT

psql "$admin" -qX -c "create database $src_db" -c "create database $dst_db"
(cd "$root/backend" && DATABASE_URL="${src/postgresql:/postgresql+asyncpg:}" uv run alembic upgrade head >/dev/null 2>&1)
psql "$src" -qX -v ON_ERROR_STOP=1 -f "$here/seed-sample.sql" >/dev/null

file="$("$here/backup.sh" "$src" "$out")"
"$here/restore.sh" "$file" "$dst"
"$here/validate.sh" "$src" "$dst"
[[ "$(psql "$dst" -qAtX -c 'select version_num from alembic_version')" == "$(psql "$src" -qAtX -c 'select version_num from alembic_version')" ]] \
  || { echo "alembic_version differs after restore"; exit 1; }
echo "Restore drill passed"
