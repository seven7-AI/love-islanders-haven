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
| #13, #59 | Provision the application Postgres, deploy the API with `DATABASE_URL` (that database), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ORIGINS`; build the web app with `VITE_API_URL` | `docs/deployment.md` steps 2–4 | Pending |
| #59 | Copy the legacy data into the application database during the maintenance window | `docs/deployment.md` steps 5–7 (`scripts/db/copy-data.sh`) | Pending |
| #15 | Apply migration `20261009140000_chat_media_bucket.sql` (private `chat-media` bucket) | `supabase db push` | Pending |
| #16 | Schedule `python -m app.jobs.expire_streaks` hourly with the API's environment | hosting platform scheduler / cron | Pending |
| #17 | Apply migration `20261009150000_settings_preferences_and_reports.sql`; decide who reviews `reports` (service-role access, e.g. Supabase dashboard) | `supabase db push` | Pending |
| #17 | Choose and configure an emergency-alert delivery provider (SMS/email); until then the API answers 503 `alerts_not_configured` and the app tells users to call emergency services | implement `AlertSender` in `backend/app/integrations/alerts` | Blocked (provider) |
| #18 | Apply migration `20261009160000_notifications.sql` | `supabase db push` | Pending |
| #19 | Set `LLM_API_KEY` (and optionally `LLM_MODEL`/`LLM_BASE_URL`) on the API; schedule `python -m app.jobs.companion_checkins`; delete the `ai-companion` edge function | `supabase functions delete ai-companion --project-ref <project-ref>` | Blocked (API key) |
| #20 | Create a Google OAuth client (Calendar read-only scope, redirect `https://<app>/calendar/callback`); set `GOOGLE_*` and `TOKEN_ENCRYPTION_KEY` on the API; apply migration `20261009170000_google_calendar_connections.sql`; delete the five old Google edge functions | Google Cloud console; `supabase db push`; `supabase functions delete <name>` | Blocked (OAuth client) |
| #21 | Apply migration `20261009180000_profile_location.sql` (also replaces table grants on `profiles` with column grants); delete the `location-services` edge function | `supabase db push`; `supabase functions delete location-services` | Pending |
| #22 | Apply migration `20261009190000_lock_down_client_access.sql` **only after** the web app build that uses the API everywhere is live (older builds query tables directly and would break) | `supabase db push` | Pending |
| #99 | Ads: if ads should run, build the web app with `VITE_ADSENSE_CLIENT` (the publisher id previously hardcoded in `index.html`) and `VITE_ADSENSE_SLOT` (an ad unit created in AdSense; none existed). Without them no ads or AdSense script load | web build args (`deploy/web/Dockerfile`) | Pending (owner decision) |
| #23 | **Rotate the Spotify client secret** committed in old commit `370a20d` (public history); set `ENVIRONMENT=production` and explicit https `CORS_ORIGINS` on the API | Spotify developer dashboard | **Urgent** |

## Known residual risks
Resolved once the #22 lockdown migration is applied: other users' `dob` readable through the Supabase API, forged
companion messages in `ai_chat_history`, and direct table writes that bypass API validation. Until then they remain.
- Profile photos are stored in a public bucket, so a photo URL stays viewable by anyone who has it, even if the photo is
  hidden on the profile.
- Unblocking someone leaves the match closed (status `blocked`); because a pair can only have one match row, they cannot
  match again. This is deliberate (an unblock should not silently reopen a conversation).
