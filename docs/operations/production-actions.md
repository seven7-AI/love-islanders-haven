# Pending production actions

Changes merged to the repository that only take effect once someone with access to the live Supabase project applies them. Each entry names the issue that introduced it.

| Issue | Action | Command / location | Status |
|---|---|---|---|
| #4 | Delete the `reset-password` edge function from the live project (removing it from the repository does not undeploy it) | `supabase functions delete reset-password --project-ref <project-ref>` | Pending |
| #4 | Allow the password recovery redirect URL | Supabase dashboard → Authentication → URL Configuration → Redirect URLs: add `https://<app-domain>/reset-password` (and `http://localhost:8080/reset-password` for local development) | Pending |
| #4 | Confirm the "Reset password" email template links to `{{ .ConfirmationURL }}` | Supabase dashboard → Authentication → Email Templates | Pending |
| #5 | Apply migration `20261009120000_harden_profiles.sql` **together with** the frontend from the same release (the old frontend writes `profiles.email`, which the migration drops) | `supabase db push` | Pending |
| #5 | Delete the `create-user-profile` edge function | `supabase functions delete create-user-profile --project-ref <project-ref>` | Pending |
| #6 | Delete the `send-verification-email` and `ai-companion-proactive` edge functions | `supabase functions delete send-verification-email --project-ref <project-ref>` and the same for `ai-companion-proactive` | Pending |
| #6 | Require email confirmation and allow the callback URL | Supabase dashboard → Authentication → Providers → Email: enable "Confirm email"; URL Configuration → Redirect URLs: add `https://<app-domain>/auth/callback` | Pending |
| #7 | Apply migration `20261009130000_enforce_matching_rules.sql` (merges any duplicate reversed matches, keeping messages) | `supabase db push` | Pending |
| #13 | Deploy the API with `DATABASE_URL` (Supabase direct connection), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ORIGINS`; run `alembic stamp 0001` (after #36); build the web app with `VITE_API_URL` | see `backend/README.md`, `docs/database/migrations.md` | Pending |
| #15 | Apply migration `20261009140000_chat_media_bucket.sql` (private `chat-media` bucket) | `supabase db push` | Pending |
| #16 | Schedule `python -m app.jobs.expire_streaks` hourly with the API's environment | hosting platform scheduler / cron | Pending |
| #17 | Apply migration `20261009150000_settings_preferences_and_reports.sql`; decide who reviews `reports` (service-role access, e.g. Supabase dashboard) | `supabase db push` | Pending |
| #17 | Choose and configure an emergency-alert delivery provider (SMS/email); until then the API answers 503 `alerts_not_configured` and the app tells users to call emergency services | implement `AlertSender` in `backend/app/integrations/alerts` | Blocked (provider) |
| #18 | Apply migration `20261009160000_notifications.sql` | `supabase db push` | Pending |
| #19 | Set `LLM_API_KEY` (and optionally `LLM_MODEL`/`LLM_BASE_URL`) on the API; schedule `python -m app.jobs.companion_checkins`; delete the `ai-companion` edge function | `supabase functions delete ai-companion --project-ref <project-ref>` | Blocked (API key) |
| #20 | Create a Google OAuth client (Calendar read-only scope, redirect `https://<app>/calendar/callback`); set `GOOGLE_*` and `TOKEN_ENCRYPTION_KEY` on the API; apply migration `20261009170000_google_calendar_connections.sql`; delete the five old Google edge functions | Google Cloud console; `supabase db push`; `supabase functions delete <name>` | Blocked (OAuth client) |
| #21 | Apply migration `20261009180000_profile_location.sql` (also replaces table grants on `profiles` with column grants); delete the `location-services` edge function | `supabase db push`; `supabase functions delete location-services` | Pending |

## Known residual risks
- Signed-in users can read other users' `dob` (and other profile columns) through the `profiles` table until profile reads move behind the API (#13).
- Unblocking someone leaves the match closed (status `blocked`); because a pair can only have one match row, they cannot match again. This is deliberate (an unblock should not silently reopen a conversation).
- Until direct table access is revoked (#22), clients can still insert rows into `ai_chat_history` through the Supabase API (RLS only checks the user id), so a user could add fake assistant messages to their own history.
- Profile images are stored in a public bucket, so an image URL remains viewable by anyone who has it, even if the image is hidden.
