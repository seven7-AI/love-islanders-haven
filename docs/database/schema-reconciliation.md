# Schema reconciliation (#8)

The Lovable-generated code referenced tables, columns and buckets that no migration creates. Each one is listed below with
the decision taken. "Repository" means checked against `supabase/migrations` and the application code.

| Object | Referenced by | Decision |
|---|---|---|
| `public.likes` | `db_migration.sql`, `rls_permissions.sql` (stale root SQL) | Files deleted in #2; the app uses `swipes`. |
| `matches.user1_id` / `user2_id` | `rls_permissions.sql` | Never existed; file deleted in #2. |
| `storage` bucket `profile_images` (underscore) | `supabase/migration.sql`, `services/profiles/image-upload.ts` | Deleted in #2; the app uses `profile-images`. |
| `user_memory`, `notifications` (as used there), `profile_interests`, `interests` | `ai-companion-proactive` | Function deleted in #6 (no caller). Notifications get a real table in #18. Interests stay in `profiles.interests text[]`. |
| `ai_conversation_memories` (pgvector) | `ai-companion/services`, `ai-companion/utils` | Dead code (`ai-companion/index.ts` imported none of it); deleted here. Conversation memory, if wanted, is designed in #19. |
| `user_settings.ai_companion_settings` | `src/components/settings/AICompanionSettings.tsx` via the settings service | Not a column; the settings service only persists four fields. Settings persistence is fixed in #17. |
| `profiles.latitude`, `longitude`, `location_updated_at` | `location-services` edge function | Missing, so location updates fail today. Added with the location work in #21. |
| `storage` bucket `media` | `src/services/messages/fileUpload.ts` | Missing, so chat media uploads fail today. Created as a private bucket with signed URLs in #15. |
| `public.users` | `google-calendar-callback` | Should have been `auth.users`; the flow is rebuilt in #20. |
| Per-function `config.toml` with `project_id = "hojcrgvdvvrfdnyccgej"` | `supabase/functions/*/config.toml` | Not read by the Supabase CLI and named a different project from `.env`. Replaced by `supabase/config.toml` (local stack settings, `verify_jwt = false` for the Google callback). |

## Live verification (superseded)
#36 planned a `supabase db diff --linked` against the live project before adopting Alembic on that database. The
owner's Supabase account has no access to the project, and the application database is now a separate Postgres
managed by Alembic (#59), so the live schema no longer needs to equal the repository. Drift is caught mechanically
during the cutover instead: applying `supabase/migrations` to the legacy database fails on unexpected objects, and
`scripts/db/copy-data.sh` fails as a whole if the legacy data has any table or column that Alembic revision `0005`
lacks (`docs/deployment.md`).
