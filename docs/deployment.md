# Deployment

Three deployables plus the existing Supabase project:

| Component | Artifact | Health check |
|---|---|---|
| API | `backend/Dockerfile` (non-root, `uvicorn app.main:create_app --factory`, port 8000) | `GET /readyz` (DB), `GET /healthz` (process) |
| Web | `deploy/web/Dockerfile` (static build + nginx, port 8080, SPA routing, CSP and security headers) or any static host | `GET /healthz` |
| Jobs | the API image running `python -m app.jobs.expire_streaks` (hourly) and `python -m app.jobs.companion_checkins` (every few hours) | exit code |
| Supabase | Auth, Storage, Postgres (existing project) | Supabase status page |

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
Configuration: `docs/environment.md`.

## First production rollout (from the Lovable-era deployment)
The order matters: the new web app needs the API, the API needs the new schema, and the old web app breaks once
`profiles.email` is dropped and once client table access is revoked. Plan a short maintenance window.

1. **Rotate the Spotify client secret** found in git history (`docs/security.md`). Independent of everything else.
2. Confirm the live schema matches the repository: `supabase db diff --linked` (issue #36). Resolve any difference first.
3. Back up: `scripts/db/backup.sh "$SUPABASE_DB_URL" backups/` (direct connection string).
4. Supabase dashboard: Auth → enable email confirmations; set Site URL to the web origin; add redirect URLs
   `https://<web>/auth/callback` and `https://<web>/reset-password`; configure production SMTP.
5. Apply the database migrations **except** the lockdown: `supabase db push` up to and including
   `20261009180000_profile_location.sql` (move `20261009190000_lock_down_client_access.sql` aside for this step), then
   `DATABASE_URL=… uv run alembic stamp head` from `backend/`.
6. Deploy the API with its secrets; check `/readyz`. Schedule the jobs.
7. Deploy the new web app; smoke-test sign-up, onboarding, discover, chat, safety.
8. Apply `20261009190000_lock_down_client_access.sql` (`supabase db push`). From now on browsers can only reach data
   through the API.
9. Delete the retired edge functions: `reset-password`, `create-user-profile`, `send-verification-email`,
   `ai-companion`, `ai-companion-proactive`, `location-services`, `check-google-auth`, `disconnect-google-calendar`,
   `fetch-google-events`, `google-calendar-auth`, `google-calendar-callback`
   (`supabase functions delete <name> --project-ref <ref>`).
10. Optional integrations: `LLM_API_KEY`, Google OAuth (`GOOGLE_*`, `TOKEN_ENCRYPTION_KEY`), emergency-alert provider.

The same checklist with status columns is kept in `docs/operations/production-actions.md`.

## Regular releases
1. Merge to `main` with all CI checks green (required by branch protection).
2. Database changes: apply new `supabase/migrations` files with `supabase db push`, then `alembic upgrade head`
   (the parity test keeps both tracks identical; the Alembic revision is then a no-op on Supabase except for
   `alembic_version`).
3. Deploy the API, then the web app (the API stays backward compatible with the previous web build within a release).

## Rollback
- **Web/API:** redeploy the previous image tag. Both are stateless.
- **Database:** migrations are applied transactionally; for a bad migration write a corrective one. For data loss,
  restore the pre-release backup into a new database and repoint (`docs/operations/database.md`).
- **Lockdown migration:** reverting it means re-granting client privileges; prefer fixing forward in the API instead.

## Mobile (Capacitor)
`npm run build && npx cap sync android`, then follow `docs/mobile/android-checklist.md`. Before the first store release
set the final `appId` in `capacitor.config.ts` (still the Lovable-generated id) and create the signing keystore. The
native app must be built with the production `VITE_*` values, and the API's `CORS_ORIGINS` must include the app's
origin (`https://localhost` / `capacitor://localhost`).
