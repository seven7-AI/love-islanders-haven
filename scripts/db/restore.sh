#!/usr/bin/env bash
# Restore a custom-format backup into an EMPTY database (refuses to overwrite existing tables).
# Usage: scripts/db/restore.sh <backup.dump> <target-postgres-url>
set -euo pipefail
file="${1:?usage: restore.sh <backup.dump> <target-postgres-url>}"
url="${2:?usage: restore.sh <backup.dump> <target-postgres-url>}"
existing="$(psql "$url" -qAtX -c "select count(*) from pg_tables where schemaname = 'public'")"
if [[ "$existing" != "0" ]]; then
  echo "Target database already has $existing public tables; restore into an empty database." >&2
  exit 1
fi
pg_restore --dbname="$url" --no-owner --no-privileges --single-transaction --exit-on-error "$file"
echo "Restored $file"
