# Common development commands. Run `make help` for the list.

# Local compose database unless overridden (e.g. DATABASE_URL=... make migrate).
DATABASE_URL ?= postgresql+asyncpg://postgres:postgres@localhost:$(or $(DB_PORT),5433)/love_islander
export DATABASE_URL
.PHONY: help up down db api-test api-lint api-typecheck api-check web-check check migrate migration db-backup db-restore-drill security-check ci

help:
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-16s %s\n", $$1, $$2}'

up: ## Start Postgres and the API (docker compose)
	docker compose up -d --build --wait

down: ## Stop the local stack
	docker compose down

db: ## Start only Postgres
	docker compose up -d --wait db

api-lint: ## Ruff lint + format check
	cd backend && uv run ruff check . && uv run ruff format --check .

api-typecheck: ## mypy (strict)
	cd backend && uv run mypy .

api-test: db ## Backend tests against the compose Postgres
	cd backend && uv run pytest

api-check: api-lint api-typecheck api-test ## All backend checks

web-check: ## Frontend format check, lint, typecheck, tests, build; documentation references
	npm run format:check && npm run lint && npm run typecheck && npm test && npm run build
	scripts/check-doc-references.py

check: web-check api-check ## Web + API checks (fast local loop)

migrate: db ## Apply Alembic migrations to the local database
	cd backend && uv run alembic upgrade head

migration: ## Autogenerate an Alembic revision: make migration m="description"
	cd backend && uv run alembic revision --autogenerate -m "$(m)"

db-backup: ## Back up the local database to backups/
	scripts/db/backup.sh postgresql://postgres:postgres@localhost:$(or $(DB_PORT),5433)/love_islander backups

db-restore-drill: db ## Backup/restore drill + Supabase→Alembic copy drill on disposable databases
	scripts/db/restore-drill.sh postgresql://postgres:postgres@localhost:$(or $(DB_PORT),5433)/postgres
	scripts/db/copy-drill.sh postgresql://postgres:postgres@localhost:$(or $(DB_PORT),5433)/postgres

security-check: ## npm audit (runtime), pip-audit, gitleaks — as in CI
	npm audit --omit=dev --audit-level=high
	cd backend && uv export --frozen --format requirements-txt --no-hashes > /tmp/love-islander-requirements.txt && uvx pip-audit -r /tmp/love-islander-requirements.txt
	docker run --rm -v "$(CURDIR):/repo" ghcr.io/gitleaks/gitleaks:v8.21.2 git /repo --no-banner --redact

ci: web-check api-check db-restore-drill security-check ## Every CI job locally (needs Docker; E2E downloads the Supabase stack)
	npm run test:db
	npm run test:e2e
