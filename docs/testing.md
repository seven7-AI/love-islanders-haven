# Testing

| Suite | Command | What it exercises | Needs |
|---|---|---|---|
| Web unit/component | `npm test` | React hooks/components, API client, mappings (Vitest + Testing Library; API modules mocked per test) | Node |
| API | `make api-test` (`cd backend && uv run pytest`) | Every endpoint and service against a real Postgres: auth, profiles, photos, discovery, swipes (incl. concurrency), messaging, streaks, notifications, settings, safety, companion, calendar, insights, hardening, observability; Alembic upgrade/downgrade/check and parity with `supabase/migrations`; backup/restore and data-copy drills | Docker (`make db`) |
| Database policies | `npm run test:db` | `supabase/migrations` on Postgres with Supabase role/auth/storage stubs: RLS, triggers, a two-session concurrency test, and the client lockdown | Docker, psql |
| End-to-end | `npm run test:e2e` | Browser (Playwright, mobile viewport) against a **real** local Supabase (Auth with emailed confirmation links, Storage, Postgres with our migrations), the API and the web app: sign-up + email confirmation, photo upload, discover → match → chat with a reply | Docker, Node, uv; first run downloads the Supabase images and Chromium (`npx playwright install chromium`) |

`KEEP_STACK=1 npm run test:e2e` leaves the local Supabase stack running for faster re-runs; `npx supabase stop` stops it.

## Test substitutes
Some external services are replaced in tests; these tests check our code's handling, **not** the real services:
- Supabase Auth in API tests: tokens signed with local keys and a local JWKS server (`backend/tests/auth_helpers.py`).
  The E2E suite uses the real Supabase Auth service.
- Storage in API tests: an in-memory `FakeStorage`; the Supabase Storage client is tested against a mocked HTTP
  transport. The E2E suite uses real Supabase Storage.
- Language model, Google OAuth/Calendar, emergency-alert delivery: scripted fakes / mocked transports. No live test
  exists until credentials are provided (see docs/operations/production-actions.md).

## From a fresh clone
`scripts/clean-clone-check.sh [repo-url] [ref]` clones into a temporary directory and runs the documented setup and
all suites there, proving nothing depends on a developer's machine state or on Lovable tooling.

## Everything at once
`make ci` runs every CI job locally: format check, lint, typecheck, unit tests and build; ruff, mypy and API tests;
the backup/restore and data-copy drills; npm audit, pip-audit and gitleaks; the database policy tests; and the
end-to-end suite. `make check` is the fast loop (web + API only).

## CI
`.github/workflows/ci.yml` runs all suites on every pull request and on `main`: web (Prettier format check, lint, typecheck, unit tests, build),
backend (ruff, ruff format, mypy, pytest, drills, Docker build), database policies, security (npm audit, pip-audit,
gitleaks) and end-to-end. Postgres and Python images come from the AWS public mirror of Docker Hub's official images
because Docker Hub rate-limits anonymous pulls on shared runners.
