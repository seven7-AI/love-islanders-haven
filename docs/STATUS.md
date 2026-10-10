# Project Status

Tracks the production-readiness work described in [`docs/audit/2026-10-audit.md`](audit/2026-10-audit.md). Issues live in the `seven7-AI/love-islanders-haven` fork.

Legend: ✅ done · 🚧 in progress · ⏳ not started · ⛔ blocked on external dependency

| # | Phase | Issue | Status |
|---|---|---|---|
| 1 | 1 Audit | Publish technical audit report and status tracker | ✅ |
| 2 | 1 Audit | Remove Lovable coupling, dead code, green tooling baseline | ✅ |
| 3 | 1 Audit | CI workflow for the web app | ✅ |
| 4 | 2 Security | Harden the password reset flow | ✅ (production action pending, see docs/operations/production-actions.md) |
| 5 | 2 Security | Harden profile write paths and read policies | ✅ (production action pending) |
| 6 | 2 Security | Move verification and auth state checks server-side | ✅ (production action pending) |
| 7 | 2 Security | Enforce matching, blocking, read-receipt rules in the database | ✅ (production action pending) |
| 8 | 3 Database | Reconcile schema references with migrations | ✅ |
| 36 | 3 Database | Verify migrations against the live Supabase project | Superseded by #59 (closed, not planned) |
| 9 | 3 Database | Scaffold FastAPI backend, config, logging, health, local Postgres | ✅ |
| 10 | 3 Database | Alembic baseline migration with indexes | ✅ |
| 11 | 3 Database | Data migration, backup and restore runbooks | ✅ (production run happens at cutover) |
| 12 | 4 Features | Backend authentication (Supabase JWT verification) | ✅ |
| 13 | 4 Features | Profiles, images, onboarding via API | ✅ (deployment pending) |
| 14 | 4 Features | Discover, swipes, matches via API | ✅ |
| 15 | 4 Features | Messaging via API | ✅ (production action pending) |
| 16 | 4 Features | Streaks via API | ✅ (job scheduling pending) |
| 17 | 4 Features | Settings, privacy, blocking, reports, safety | ✅ (alert provider ⛔) |
| 18 | 4 Features | Notifications | ✅ |
| 19 | 4 Features | AI companion on LLM provider interface | ✅ (live check ⛔ API key) |
| 20 | 4 Features | Google Calendar integration | ✅ (live check ⛔ Google OAuth client) |
| 21 | 4 Features | Location and distance filtering | ✅ |
| 22 | 4 Features | Retire direct Supabase data access and edge functions | ✅ (production action pending) |
| 23 | 5 Hardening | Rate limiting, CORS, headers, dependency scanning | ✅ (Spotify secret rotation pending) |
| 24 | 5 Hardening | Observability | ✅ |
| 25 | 6 Testing | Playwright E2E | ✅ |
| 26 | 6 Testing | Complete CI pipeline | ✅ |
| 27 | 7 Docs | Documentation and deployment artifacts | ✅ |
| 28 | 7 Docs | Clean-clone verification and upstream PR | ✅ |
| 58 | 3 Database | Run the API on its own Alembic-managed Postgres | ✅ |
| 59 | 3 Database | Make Alembic the only schema authority and retire live-Supabase reconciliation | ✅ |

## External blockers
- Supabase project access for the cutover (legacy database connection string, Auth settings, function undeployment)
- OpenAI API key, Resend API key + verified sender domain, Google OAuth client
- Production hosting target, Android signing keystore, final Capacitor `appId` (currently the Lovable-generated id)

## Clean-clone verification
`scripts/clean-clone-check.sh` (2026-10-09, fork `main` at `e380da3`): fresh `git clone` → no Lovable tooling
referenced → `npm ci`, `uv sync` → Postgres via compose, `alembic upgrade head` (0005) → `make check`: Prettier, ESLint
(0 errors), typecheck, 23 test files / 88 web tests, build, ruff, mypy, 169 API tests → 12 database policy suites →
3/3 end-to-end tests against a local Supabase (real Auth, Storage, Postgres), the API and the web app.
