#!/usr/bin/env bash
# Copy application data from the legacy Supabase database into the application Postgres, whose schema is created by
# Alembic (docs/operations/database.md).
#
# Usage: scripts/db/copy-data.sh <supabase-postgres-url> <target-postgres-url>
#   The source must have all of supabase/migrations applied; the target must be at the cutover revision
#   (`alembic upgrade 0005`, the revision equal to the frozen Supabase schema) and contain no application rows. Run `alembic upgrade head` afterwards.
#   Any table or column the target does not have makes the copy fail as a whole; nothing is half-copied.
#   User accounts stay in Supabase Auth: profiles.id keeps the auth user id.
set -euo pipefail
src="${1:?usage: copy-data.sh <supabase-url> <target-url>}"
dst="${2:?usage: copy-data.sh <supabase-url> <target-url>}"
here="$(cd "$(dirname "$0")" && pwd)"

# Every application row depends on a profile, so an empty profiles table means an empty target.
has_rows="$(psql "$dst" -qAtX -c "select exists (select 1 from public.profiles)")"
[[ "$has_rows" == "f" ]] || { echo "Target already contains application rows; refusing to copy." >&2; exit 1; }
cutover=0005
version="$(psql "$dst" -qAtX -c "select version_num from alembic_version" 2>/dev/null)" || true
[[ "$version" == "$cutover" ]] || {
  echo "Target must be at Alembic revision $cutover (found '${version:-none}'); run alembic upgrade $cutover first." >&2; exit 1; }

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
# Data only, public schema, application tables in dependency order handled by pg_restore.
pg_dump "$src" --data-only --schema=public --format=custom --no-owner --no-privileges \
  --exclude-table=public.alembic_version --file="$tmp/data.dump"
# One transaction: either everything is copied or nothing is.
pg_restore --dbname="$dst" --data-only --single-transaction --exit-on-error "$tmp/data.dump"

"$here/validate.sh" "$src" "$dst"
