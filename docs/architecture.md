# Architecture

```
Browser / Capacitor app (React 18, Vite, Tailwind/shadcn)  ── src/
   │  supabase-js: sign-in, sessions, signed file uploads only
   │  src/lib/api/*: everything else (Bearer = Supabase access token)
   ▼
Love Islander API (FastAPI, Python 3.12)  ── backend/
   app/api/            HTTP routes (validation with pydantic; problem+json errors)
   app/services/       business rules: profiles, discovery & matching, messaging, streaks, notifications,
                       settings & safety, AI companion, calendar, insights
   app/integrations/   auth (Supabase JWT/JWKS), storage (Supabase Storage), llm (OpenAI-compatible),
                       google (OAuth + Calendar), alerts (delivery interface; no provider yet)
   app/jobs/           scheduled commands (expire_streaks, companion_checkins)
   app/core/           config, logging, errors, middleware (request ids, security headers, body limit),
                       rate limits, metrics, crypto
   ▼
Postgres (Supabase-hosted today)          Supabase Auth             Supabase Storage
  schema: supabase/migrations (Supabase     users, sessions,          profile-images (public),
  objects + RLS) and backend/alembic        confirmation emails       chat-media (private, signed URLs)
  (portable schema), kept identical by a
  parity test
```

## Responsibilities
| Concern | Where | Notes |
|---|---|---|
| Presentation | `src/` | No business rules or direct table access (lint rule enforces it) |
| Business logic | `backend/app/services` | Every rule enforced server-side: 18+, photo limits, mutual matching under a lock, blocks, read receipts, streak arithmetic, rate limits |
| Persistence | Postgres via SQLAlchemy | Supabase migrations own RLS/auth triggers/storage; Alembic owns the portable schema (`docs/database/migrations.md`) |
| Authentication | Supabase Auth → API `TokenVerifier` | API trusts only the verified token's `sub` |
| Files | Supabase Storage behind `StorageProvider` | API issues signed upload URLs after validating type, size, ownership |
| Integrations | `backend/app/integrations/*` behind interfaces | Missing credentials produce explicit 503 errors, never simulated success |
| Background work | `backend/app/jobs/*` run by a scheduler | idempotent; see `backend/README.md` |
| Observability | structured logs, `/metrics`, `/healthz`, `/readyz`, optional Sentry | `docs/operations/observability.md` |

## Key flows
- **Sign-up:** Supabase Auth creates `auth.users` → trigger creates `profiles` + `profile_onboarding` → user confirms email →
  `/auth/callback` → onboarding (API: profile fields, photos, step; completion requires name, DOB 18+, gender,
  preference and 4 photos).
- **Discover/match:** `GET /v1/discover` applies both users' preferences, blocks, swipes and distance; `POST /v1/swipes`
  records the swipe and, under a per-pair advisory lock, creates exactly one match on a mutual like and notifies both.
- **Chat:** messages only within active, unblocked matches; the web app polls for new messages; media is private.
- **Safety:** blocking closes matches and hides people everywhere; reports go to moderators; emergency alerts need a
  delivery provider (not yet integrated, reported honestly to the user).

## Supabase dependency
Supabase remains the auth provider, file store and database host. The app's data layer does not depend on Supabase
APIs: the API talks to Postgres directly and the schema is portable (Alembic). Replacing Auth or Storage means
implementing `TokenVerifier` / `StorageProvider`; moving the database is covered by `docs/operations/database.md`.
