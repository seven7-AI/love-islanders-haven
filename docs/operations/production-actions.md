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

## Known residual risks
- Signed-in users can read other users' `dob` (and other profile columns) through the `profiles` table until profile reads move behind the API (#13).
- Profile images are stored in a public bucket, so an image URL remains viewable by anyone who has it, even if the image is hidden.
