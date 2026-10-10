# Database operations: backup, restore, migration

Scripts live in `scripts/db/`. They take libpq URLs (`postgresql://user:password@host:port/database`) and need
`psql`, `pg_dump` and `pg_restore` at least as new as the server (Postgres 15/16).

| Script | Purpose |
|---|---|
| `backup.sh <url> [dir]` | Custom-format `pg_dump`; verifies the archive is readable; prints the file path |
| `restore.sh <file> <url>` | Restores into an **empty** database in one transaction; refuses if public tables exist |
| `validate.sh <src> <dst>` | Exact per-table row counts + integrity checks (no reversed duplicate matches, no orphan messages, no under-18 profiles); non-zero exit on any difference |
| `copy-data.sh <supabase-url> <target-url>` | Data-only copy of the app tables from Supabase into an Alembic-migrated, empty Postgres, then `validate.sh` |
| `restore-drill.sh <server-url>` / `copy-drill.sh <server-url>` | Disposable end-to-end drills (run in CI) |

## Backups
Schedule `backup.sh` daily against the application database (cron or the platform's job runner) and ship the file to
encrypted object storage with lifecycle-based retention (at least 7 daily + 4 weekly copies; `backups/` is
git-ignored). Take an extra backup before every production migration. Managed Postgres services' own snapshots/PITR
are a complement, not a replacement. Use a direct connection, not a pooler.

## Restore
1. Create an empty database (never restore over a live one).
2. `scripts/db/restore.sh <file> <new-db-url>`
3. `scripts/db/validate.sh <url-of-a-reference-copy> <new-db-url>` when a reference exists; otherwise check row counts against the backup's source.
4. Point `DATABASE_URL` (API) at the restored database.

The drill (`make db-restore-drill`) exercises steps 1–3 on sample data and runs in CI.

## Moving the legacy data off Supabase (one time)
The full sequence is in `docs/deployment.md` (First production rollout). In short:
1. Freeze writes and back up the legacy Supabase database.
2. Apply `supabase/migrations` (without the lockdown) to it so its data has the shape of Alembic revision `0005`.
3. On the empty application database: `alembic upgrade 0005`.
4. `scripts/db/copy-data.sh "$SUPABASE_DB_URL" "$APP_DB_URL"` (single transaction; validates counts and integrity),
   then `alembic upgrade head`.
5. Repoint the API, unfreeze, lock down the legacy tables and keep them read-only for an agreed period.

User accounts remain in Supabase Auth; `profiles.id` keeps the auth user id. The drill `scripts/db/copy-drill.sh`
runs this sequence on sample data in CI.

## Rollback
- **Failed migration:** migrations run in a transaction and roll back on error. For a migration that succeeded
  but is wrong, apply a corrective migration; for data loss, restore the pre-migration backup into a new database and
  repoint (or restore selected tables from it).
- **Failed data move:** `copy-data.sh` is all-or-nothing and never modifies the source. The target stays empty, so fix
  the cause and rerun it.

## Not yet done
Running these against production needs the legacy database's connection string and happens during the cutover.
