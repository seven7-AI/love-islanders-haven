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
| 62 | 8 Structure | Repository structure audit and target layout | ✅ |
| 63 | 8 Structure | Remove stale and accidentally tracked items | ✅ |
| 64 | 8 Structure | Move the frontend into `web/` with an npm-workspaces root | ✅ |
| 65 | 8 Structure | Make `e2e/` a self-contained workspace | ✅ |
| 66 | 8 Structure | Docs index and regrouping without duplication | ✅ |
| 67 | 8 Structure | Generated API reference | ✅ |
| 68 | 8 Structure | Clean-clone verification of the new layout | ✅ |
| 76 | 9 Functional | Functional audit and test coverage matrix | ✅ |
| 77 | 9 Functional | Settings page crash (provider not mounted) | ✅ |
| 78 | 9 Functional | Profile field mapping (hidden age, gender preference, goal values) | ✅ |
| 79 | 9 Functional | Insights tabs, hardcoded figures, missing error states | ✅ |
| 80 | 9 Functional | One navigation bar, responsive layout, touch photo controls | ✅ |
| 81 | 9 Functional | Avatars skip hidden photos, onboarding flags, uploads checked server-side | ✅ (bucket limits: production action) |
| 82 | 9 Functional | Unmatch, read receipts, streak captions, older companion messages | ✅ |
| 83 | 9 Functional | Image fallbacks, re-signed chat media, AdSense opt-in | ✅ |
| 84 | 9 Functional | Moderator role, report review API, operator CLI | ✅ (choose moderators: owner) |
| 85 | 9 Functional | Moderation page and role-aware navigation | ✅ |
| 86 | 9 Functional | Pexels configuration and server-side client | ✅ |
| 87 | 9 Functional | Seed accounts in every state | ✅ |
| 88 | 9 Functional | E2E harness: seeded CI, error guard, three viewports | ✅ |
| 89 | 9 Functional | Page-by-page E2E suites | ✅ |
| 98, 99 | 9 Functional | README screenshots; UI defects they showed | ✅ |
| 109, 111, 113 | 9 Functional | Defects found by the E2E suites: sign-in redirect race, hidden toasts, page remounts | ✅ |
| 116 | 9 Functional | Untrack the committed Pexels photo cache and CLI state; CI fails on tracked ignored files | ✅ (files remain in history: owner decision) |
| 90 | 9 Functional | Production-readiness review | ✅ |

## Before launch
The code is complete and tested. These need the owner (credentials, providers, decisions), so they are not done:
- **Production steps:** apply the pending actions in [production-actions.md](operations/production-actions.md),
  including the database cutover, Storage bucket limits, Alembic `0006`/`0007`, and the urgent Spotify secret rotation.
- **AI companion:** set `LLM_API_KEY`. Until then Isla says she is unavailable (verified in E2E). Replies from a real
  provider have not been tested.
- **Google Calendar:** create an OAuth client. Until then the app says sync isn't available (verified in E2E).
- **Emergency alerts:** choose and integrate an SMS/email provider (`AlertSender`). Until then the app says alerts
  aren't set up and offers the emergency number (verified in E2E).
- **Email:** configure a production SMTP sender in Supabase Auth; the built-in sender is rate-limited.
- **Legal and support:** publish the Terms of Service and Privacy Policy. The pages say they are not published yet;
  Support points to the in-app feedback form and the Safety centre.
- **Moderation:** decide who moderates and grant them the role. Reviewing a report records a decision; there is no
  suspension or ban feature.
- **Hosting and mobile:** production hosting target, Android signing keystore, final Capacitor `appId` (currently
  the Lovable-generated id).
- **Repository history:** the seed's downloaded Pexels photos (`backend/.seed-cache/`, committed by mistake in #100,
  untracked in #116) are still in earlier commits. Removing them needs a history rewrite of the fork and of this
  PR's commits. Decide before merging upstream.
- **Optional:** a `PEXELS_API_KEY` repository secret, so CI seeds with the real stock photos instead of placeholders.

## Clean-clone verification
`scripts/clean-clone-check.sh` (2026-10-10, branch `90-readiness-review` at `0e18363`, merged as the #90 PR; no local
Supabase stack or E2E database running beforehand):
- fresh `git clone`, no Lovable tooling referenced
- tracked root entries equal the documented layout, with one lockfile
- `npm ci` (workspaces `web`, `e2e`) and `uv sync`
- Postgres via compose, `alembic upgrade head` (0007)
- `make check`:
  - Prettier
  - ESLint (0 errors, 41 warnings)
  - typecheck (web and e2e)
  - 44 test files / 165 web tests
  - build
  - 25 Markdown files with 0 broken references
  - ruff, mypy
  - 237 API tests
- restore and copy drills
- web and API images built
- 12 database policy suites
- seed run twice and verified (46 generated placeholder photos: a clone has no Pexels key or cache)
- end-to-end: 79 passed, 8 skipped (the guard self-checks run only in the mobile project), across mobile, tablet and
  desktop on the API's own Alembic Postgres, local Supabase Auth and Storage, and the web app

Earlier runs the same day from `main` at `af23d96`:
1. Passed, but reused a local stack that was still running; the script now refuses that.
2. One E2E failure (mobile password reset). Its output was lost with the clone; the script now keeps it. The test
   passed in every later run (12/12 auth and sign-up specs on a fresh stack, then 79/79 and 76/76 full suites).
3. Passed from scratch.

Previous runs: 2026-10-10 at `0aed16d` (after the reorganization), 2026-10-09 at `e380da3`.
