# Deployment

Three deployables, a Postgres database, and the existing Supabase project for Auth and Storage:

| Component | Artifact | Health check |
|---|---|---|
| API | `backend/Dockerfile` (non-root, `uvicorn app.main:create_app --factory`, port 8000) | `GET /readyz` (DB), `GET /healthz` (process) |
| Web | `deploy/web/Dockerfile` (static build + nginx, port 8080, SPA routing, CSP and security headers) or any static host | `GET /healthz` |
| Jobs | the API image running the scheduled commands listed in [backend/README.md](../backend/README.md#scheduled-jobs) | exit code |
| Database | Postgres 16 (managed service or self-hosted), schema from `alembic upgrade head` | `GET /readyz` |
| Supabase | Auth and Storage (existing project) | Supabase status page |

Any container platform works (e.g. Cloud Run, Fly.io, Render, ECS). Requirements: HTTPS termination, secrets as
environment variables, a scheduler for the jobs, and log collection from stdout. Run at least two API instances behind
the load balancer for availability (note that rate limits are per instance, `docs/security.md`).

## Build
```bash
docker build -t love-islander-api backend
docker build -f deploy/web/Dockerfile -t love-islander-web \
  --build-arg VITE_SUPABASE_URL=https://<ref>.supabase.co \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key> \
  --build-arg VITE_API_URL=https://api.<domain> .
docker run -e API_ORIGIN=https://api.<domain> -e SUPABASE_ORIGIN=https://<ref>.supabase.co -p 8080:8080 love-islander-web
```
Configuration: [development/environment.md](development/environment.md).

## First production rollout (from the Lovable-era deployment)
The data moves from the legacy Supabase database into the new application database. The order matters: the old web
app breaks once `profiles.email` is dropped and once client table access is revoked, so plan a maintenance window
in which writes are frozen (steps 5–9).

1. **Rotate the Spotify client secret** found in git history (`docs/security.md`). Independent of everything else.
2. Provision Postgres 16 for the application. From `backend/`: `DATABASE_URL=… uv run alembic upgrade 0005` (the
   cutover revision; `docs/database/migrations.md`).
3. Supabase dashboard: Auth → enable email confirmations; set Site URL to the web origin; add redirect URLs
   `https://<web>/auth/callback` and `https://<web>/reset-password`; configure production SMTP.
4. Deploy the API pointing at the new database (`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `CORS_ORIGINS`) but do not route traffic to it yet; check `/readyz`.
5. Start the maintenance window. Back up the legacy database:
   `scripts/db/backup.sh "$SUPABASE_DB_URL" backups/` (direct connection string).
6. Apply `supabase/migrations` to the legacy project **except** the lockdown (`supabase db push` up to and including
   `20261009180000_profile_location.sql`). This brings the legacy data to the shape of revision `0005` (drops
   `profiles.email`, merges duplicate reversed matches, adds the storage buckets). If the live database has drifted
   from the repository, this step fails and changes nothing.
7. Copy the data: `scripts/db/copy-data.sh "$SUPABASE_DB_URL" "$APP_DB_URL"`. It runs in one transaction, fails as a
   whole on any table or column the new schema lacks, and validates row counts and integrity afterwards. Then
   `DATABASE_URL=… uv run alembic upgrade head`.
8. Deploy the new web app; smoke-test sign-up, onboarding, discover, chat, safety. Schedule the jobs.
9. Apply `20261009190000_lock_down_client_access.sql` to the legacy project (`supabase db push`) so nothing can read or
   write the old tables from browsers. End the maintenance window. Keep the legacy tables read-only until the new
   database has run cleanly for an agreed period, then drop them.
10. Delete the retired edge functions: `reset-password`, `create-user-profile`, `send-verification-email`,
   `ai-companion`, `ai-companion-proactive`, `location-services`, `check-google-auth`, `disconnect-google-calendar`,
   `fetch-google-events`, `google-calendar-auth`, `google-calendar-callback`
   (`supabase functions delete <name> --project-ref <ref>`).
11. Optional integrations: `LLM_API_KEY`, Google OAuth (`GOOGLE_*`, `TOKEN_ENCRYPTION_KEY`), emergency-alert provider.

The same checklist with status columns is kept in `docs/operations/production-actions.md`.

## Regular releases
1. Merge to `main` with all CI checks green (required by branch protection).
2. Database changes: back up, then `alembic upgrade head` against the application database.
3. Deploy the API, then the web app (the API stays backward compatible with the previous web build within a release).

## Rollback
- **Web/API:** redeploy the previous image tag. Both are stateless.
- **Database:** migrations are applied transactionally; for a bad migration write a corrective one. For data loss,
  restore the pre-release backup into a new database and repoint (`docs/operations/database.md`).
- **Cutover:** before step 6 nothing has changed for users. After step 6 the old web app no longer works against the
  legacy database (it writes `profiles.email`); to go back, restore the step 5 backup into the legacy project and
  redeploy the old web app. `copy-data.sh` never modifies the source.

## Mobile (Capacitor)
`npm run build && (cd web && npx cap sync android)`, then follow `docs/mobile/android-checklist.md`. Before the first store release
set the final `appId` in `web/capacitor.config.ts` (still the Lovable-generated id) and create the signing keystore. The
native app must be built with the production `VITE_*` values, and the API's `CORS_ORIGINS` must include the app's
origin (`https://localhost` / `capacitor://localhost`).
