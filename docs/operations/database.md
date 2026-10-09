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
- **Supabase (current production):** the platform takes daily backups (and PITR on paid plans). In addition, take a logical
  backup before every production migration:
  ```bash
  scripts/db/backup.sh "$SUPABASE_DB_URL" backups/
  ```
  Use the *direct* connection string (Project Settings → Database), not the pooler. Store dumps encrypted, outside the repo
  (`backups/` is git-ignored), and keep at least 7 daily + 4 weekly copies.
- **Self-hosted Postgres (after a move):** schedule `backup.sh` daily (cron or the platform's job runner) and ship the file to
  object storage with lifecycle-based retention.

## Restore
1. Create an empty database (never restore over a live one).
2. `scripts/db/restore.sh <file> <new-db-url>`
3. `scripts/db/validate.sh <url-of-a-reference-copy> <new-db-url>` when a reference exists; otherwise check row counts against the backup's source.
4. Point `DATABASE_URL` (API) / the Supabase project at the restored database.

The drill (`make db-restore-drill`) exercises steps 1–3 on sample data and runs in CI.

## Moving to Alembic management
**Staying on Supabase Postgres (recommended while Supabase Auth/Storage are used):** no data moves.
```bash
scripts/db/backup.sh "$SUPABASE_DB_URL" backups/
DATABASE_URL="postgresql+asyncpg://…supabase…" uv run alembic stamp 0001   # from backend/
```
This requires the live schema to equal the repository migrations first (#36).

**Moving the data to another Postgres:**
1. Freeze writes (maintenance mode) and take a backup of Supabase.
2. On the target: `alembic upgrade head` (empty database).
3. `scripts/db/copy-data.sh "$SUPABASE_DB_URL" "$TARGET_DB_URL"` (single transaction; validates counts and integrity).
4. Repoint the API, unfreeze, keep the Supabase database read-only until the new one has run cleanly for an agreed period.

User accounts remain in Supabase Auth in both cases; `profiles.id` keeps the auth user id.

## Rollback
- **Failed migration on Supabase:** migrations run in a transaction and roll back on error. For a migration that succeeded
  but is wrong, apply a corrective migration; for data loss, restore the pre-migration backup into a new database and
  repoint (or restore selected tables from it).
- **Failed data move:** `copy-data.sh` is all-or-nothing; the source is never modified. Keep running on Supabase.

## Not yet done
Running these against production needs database credentials and is part of #36 and the cutover (#22).
