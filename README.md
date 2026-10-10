# Love Islander

A dating app: profiles and photos, discovery with mutual matching, chat, daily photo streaks, an AI dating companion,
Google Calendar date planning, and safety tools (blocking, reporting, safety contacts, date plans, emergency alerts).

- **Web/mobile client:** React 18 + TypeScript + Vite, Tailwind/shadcn, Capacitor shell (`web/`)
- **API:** FastAPI + SQLAlchemy + Alembic on Python 3.12 (`backend/`)
- **Platform:** Postgres 16 (schema by Alembic), Supabase Auth and Storage (`supabase/`)

## Repository layout
| Path | Contents |
|---|---|
| `web/` | React + Vite web app and Capacitor shell |
| `backend/` | FastAPI API, Alembic migrations, API tests |
| `e2e/` | Playwright end-to-end tests for the whole stack |
| `supabase/` | Supabase CLI project: local Auth/Storage config, frozen legacy migrations, policy tests |
| `deploy/` | Web image (Dockerfile, nginx) |
| `scripts/` | End-to-end runner, clean-clone check, database operations (`scripts/db/`) |
| `docs/` | Documentation ([index](docs/README.md)) |

The root `package.json` is an npm-workspaces root (`web`, `e2e`); `npm run build`, `npm test`, `npm run lint` and the
other scripts run from the root. Details: [docs/development/repository-layout.md](docs/development/repository-layout.md).

## Getting started
Set up from a fresh clone with [docs/development/setup.md](docs/development/setup.md); the test suites and the
`make check` / `make ci` shortcuts are described in [docs/development/testing.md](docs/development/testing.md).
All documentation is listed in [docs/README.md](docs/README.md).
