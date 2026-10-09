#!/usr/bin/env bash
# Copy application data from the Supabase database into a separate Postgres whose schema was created by Alembic.
# Only needed when moving the data off Supabase Postgres; staying on Supabase only needs `alembic stamp 0001`
# (docs/operations/database.md).
#
# Usage: scripts/db/copy-data.sh <supabase-postgres-url> <target-postgres-url>
#   The target must be at the Alembic baseline (`alembic upgrade head`) and contain no application rows.
#   User accounts stay in Supabase Auth: profiles.id keeps the auth user id.
set -euo pipefail
src="${1:?usage: copy-data.sh <supabase-url> <target-url>}"
dst="${2:?usage: copy-data.sh <supabase-url> <target-url>}"
here="$(cd "$(dirname "$0")" && pwd)"

# Every application row depends on a profile, so an empty profiles table means an empty target.
has_rows="$(psql "$dst" -qAtX -c "select exists (select 1 from public.profiles)")"
[[ "$has_rows" == "f" ]] || { echo "Target already contains application rows; refusing to copy." >&2; exit 1; }
psql "$dst" -qAtX -c "select version_num from alembic_version" >/dev/null || {
  echo "Target has no alembic_version table; run alembic upgrade head first." >&2; exit 1; }

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
# Data only, public schema, application tables in dependency order handled by pg_restore.
pg_dump "$src" --data-only --schema=public --format=custom --no-owner --no-privileges \
  --exclude-table=public.alembic_version --file="$tmp/data.dump"
# One transaction: either everything is copied or nothing is.
pg_restore --dbname="$dst" --data-only --single-transaction --exit-on-error "$tmp/data.dump"

"$here/validate.sh" "$src" "$dst"
