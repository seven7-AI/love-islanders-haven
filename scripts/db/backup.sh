#!/usr/bin/env bash
# Custom-format backup of a Postgres database.
# Usage: scripts/db/backup.sh <postgres-url> [output-dir]      (url: postgresql://user:pass@host:port/db)
# Writes <output-dir>/<db>-<UTC timestamp>.dump and prints its path. Requires pg_dump >= the server version.
set -euo pipefail
url="${1:?usage: backup.sh <postgres-url> [output-dir]}"
out_dir="${2:-backups}"
mkdir -p "$out_dir"
db_name="$(psql "$url" -qAtX -c 'select current_database()')"
file="$out_dir/${db_name}-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump "$url" --format=custom --no-owner --no-privileges --file="$file"
# A backup that cannot be listed is not a backup.
pg_restore --list "$file" >/dev/null
echo "$file"
