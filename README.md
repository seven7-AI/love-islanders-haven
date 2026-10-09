# Love Islander

A dating app: profiles and photos, discovery with mutual matching, chat, daily photo streaks, an AI dating companion,
Google Calendar date planning, and safety tools (blocking, reporting, safety contacts, date plans, emergency alerts).

- **Web/mobile client:** React 18 + TypeScript + Vite, Tailwind/shadcn, Capacitor shell (`src/`)
- **API:** FastAPI + SQLAlchemy + Alembic on Python 3.12 (`backend/`)
- **Platform:** Supabase Auth, Storage and Postgres (`supabase/`)

## Quick start
```bash
npm ci && (cd backend && uv sync)
KEEP_STACK=1 npm run test:e2e   # starts a local Supabase + API + web and runs the end-to-end tests
```
Full instructions: [docs/setup.md](docs/setup.md).

## Checks
```bash
make check   # web: format, lint, typecheck, tests, build; API: ruff, mypy, tests
make ci      # everything CI runs, incl. database policy tests, security scans and end-to-end tests
```

## Documentation
| Topic | Document |
|---|---|
| Architecture | [docs/architecture.md](docs/architecture.md) |
| Local setup | [docs/setup.md](docs/setup.md) |
| Environment variables | [docs/environment.md](docs/environment.md) |
| Database & migrations | [docs/database/migrations.md](docs/database/migrations.md), [schema reconciliation](docs/database/schema-reconciliation.md) |
| Testing | [docs/testing.md](docs/testing.md) |
| External services | [docs/external-services.md](docs/external-services.md) |
| Deployment | [docs/deployment.md](docs/deployment.md) |
| Security | [docs/security.md](docs/security.md) |
| Operations | [backups & restore](docs/operations/database.md), [observability](docs/operations/observability.md), [pending production actions](docs/operations/production-actions.md) |
| API reference | `GET /docs` on a non-production API (OpenAPI) and [backend/README.md](backend/README.md) |
| Project status & audit | [docs/STATUS.md](docs/STATUS.md), [docs/audit/2026-10-audit.md](docs/audit/2026-10-audit.md) |
| Mobile | [docs/mobile/](docs/mobile/) |
