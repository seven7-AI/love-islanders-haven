# Pending production actions

Changes merged to the repository that only take effect once someone with access to the live Supabase project applies them. Each entry names the issue that introduced it.

| Issue | Action | Command / location | Status |
|---|---|---|---|
| #4 | Delete the `reset-password` edge function from the live project (removing it from the repository does not undeploy it) | `supabase functions delete reset-password --project-ref <project-ref>` | Pending |
| #4 | Allow the password recovery redirect URL | Supabase dashboard → Authentication → URL Configuration → Redirect URLs: add `https://<app-domain>/reset-password` (and `http://localhost:8080/reset-password` for local development) | Pending |
| #4 | Confirm the "Reset password" email template links to `{{ .ConfirmationURL }}` | Supabase dashboard → Authentication → Email Templates | Pending |
