# External services

| Service | Used for | Configured by | Status | Without it |
|---|---|---|---|---|
| Supabase Auth | sign-up, login, sessions, password reset, email confirmation | Supabase project; `VITE_SUPABASE_*`, API `SUPABASE_URL` | Required; verified end-to-end against the local Supabase stack | app cannot start |
| Supabase Storage | profile/streak photos (public bucket), chat media (private) | `SUPABASE_SERVICE_ROLE_KEY` | Verified end-to-end locally | photo and media endpoints return 503 |
| Postgres 16 (managed or self-hosted) | application database | `DATABASE_URL` | Required; schema by Alembic, verified in CI and end-to-end | API cannot start (`/readyz` fails) |
| Email delivery (Supabase Auth SMTP) | confirmation and reset emails | Supabase dashboard → Auth → SMTP | Owner must configure a production SMTP sender | Supabase's built-in sender is rate-limited |
| OpenAI-compatible LLM | AI companion | `LLM_API_KEY` | **Not verified live** (no key); client tested against a mocked API | companion answers 503 `ai_not_configured` |
| Google OAuth + Calendar | calendar sync | `GOOGLE_*`, `TOKEN_ENCRYPTION_KEY` | **Not verified live** (no OAuth client); flow tested against a mocked Google | connect button hidden; endpoints 503 |
| Emergency alert delivery (SMS/email) | safety alerts to contacts | implement `AlertSender` | **Not integrated** (no provider chosen) | alerts answer 503 and the app tells users to call emergency services |
| Google AdSense | ads (`index.html`) | publisher id in `index.html` | Pre-existing; unchanged | – |
| Sentry (optional) | error tracking | `SENTRY_DSN` | Optional | errors only in logs |
