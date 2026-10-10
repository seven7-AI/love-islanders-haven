# Testing

| Suite | Command | What it exercises | Needs |
|---|---|---|---|
| Web unit/component | `npm test` | React hooks/components, API client, mappings (Vitest + Testing Library; API modules mocked per test) | Node |
| API | `make api-test` (`cd backend && uv run pytest`) | Every endpoint and service against a real Postgres: auth, profiles, photos, discovery, swipes (incl. concurrency), messaging, streaks, notifications, settings, safety, companion, calendar, insights, hardening, observability; Alembic upgrade/downgrade/check and parity of the cutover revision with the frozen `supabase/migrations` | Docker (`make db`) |
| Database drills | `make db-restore-drill` | Shell drills on disposable databases: backup → restore → validate, and the legacy Supabase → Alembic data copy at the cutover revision followed by `alembic upgrade head` | Docker (`make db`), psql/pg_dump |
| Database policies | `npm run test:db` | `supabase/migrations` on Postgres with Supabase role/auth/storage stubs: RLS, triggers, a two-session concurrency test, and the client lockdown | Docker, psql |
| End-to-end | `npm run test:e2e` | Browser (Playwright, Chromium) at three sizes (projects `mobile` Pixel 7, `tablet` iPad, `desktop` 1366×900) against the API on its own Postgres (schema created by `alembic upgrade head`), a **real** local Supabase for Auth (with emailed confirmation links) and Storage, and the web app: sign-up + email confirmation, photo upload, discover → match → chat with read receipts → unmatch, moderation (role granted with the operator CLI). Every test fails on a console error, an uncaught page error or a 5xx response (`e2e/support/fixtures.ts`; a test may allow a specific, deliberate problem with `guard.allow`; `guard.spec.ts` checks the guard itself) | Docker, Node, uv; first run downloads the Supabase images and Chromium (`npm exec -w e2e -- playwright install chromium`); specs, helpers and `playwright.config.ts` live in `e2e/`, failure reports in `e2e/playwright-report/`; one project: `npm run test:e2e -- --project=mobile` |

`SEED=1 npm run test:e2e` first runs the seed (run, run again, verify; see [seed data](seed-data.md)) and then the tests on top of it; CI always runs this way. `KEEP_STACK=1 npm run test:e2e` leaves the local Supabase stack and the `love-islander-e2e-db` container running for faster re-runs; `npx supabase stop` and `docker rm -f love-islander-e2e-db` stop them.

## Test substitutes
Some external services are replaced in tests; these tests check our code's handling, **not** the real services:
- Supabase Auth in API tests: tokens signed with local keys and a local JWKS server (`backend/tests/auth_helpers.py`).
  The E2E suite uses the real Supabase Auth service.
- Storage in API tests: an in-memory `FakeStorage`; the Supabase Storage client is tested against a mocked HTTP
  transport. The E2E suite uses real Supabase Storage.
- Language model, Google OAuth/Calendar, emergency-alert delivery: scripted fakes / mocked transports. No live test
  exists until credentials are provided (see docs/operations/production-actions.md).

## README screenshots
`SEED=1 npm run test:e2e -- --config=playwright.screenshots.config.ts` seeds the stack and captures the README
screenshots through the real UI (`e2e/screenshots/`, written to `docs/images/screenshots/`). It is not part of the test
suite; re-run it after visible UI changes.

## Documentation references
`scripts/check-doc-references.py` (part of `make check` and the CI web job) fails when a Markdown file links to a
missing file (Markdown links and HTML `src`/`href`, e.g. README images) or names a repository path that does not exist.

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
