# Common development commands. Run `make help` for the list.
.PHONY: help up down db api-test api-lint api-typecheck api-check web-check check

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

web-check: ## Frontend lint, typecheck, tests, build
	npm run lint && npm run typecheck && npm test && npm run build

check: web-check api-check ## Everything CI runs (except the Supabase policy tests: npm run test:db)
