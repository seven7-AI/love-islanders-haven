#!/usr/bin/env bash
# Proves the project builds, tests and runs from a fresh clone without Lovable tooling, following docs/development/setup.md.
# Usage: scripts/clean-clone-check.sh [repo-url] [ref]     (default: this repository's origin, main)
# Needs: git, Node 22 + npm, uv, Docker, psql. Uses DB port 5434 so it does not touch a running dev database.
set -euo pipefail
repo="${1:-$(git config --get remote.origin.url)}"
ref="${2:-main}"
work="$(mktemp -d)"
export COMPOSE_PROJECT_NAME=clean-clone-check DB_PORT=5434
trap 'cd /; (cd "$work/app" 2>/dev/null && docker compose down -v >/dev/null 2>&1); docker rmi -f clean-clone-web clean-clone-api >/dev/null 2>&1; rm -rf "$work"' EXIT

step() { printf '\n==> %s\n' "$*"; }

step "clone $repo@$ref"
git clone --quiet --depth 1 --branch "$ref" "$repo" "$work/app"
cd "$work/app"
git log -1 --format='commit %H (%s)'
if grep -rniE 'lovable-tagger|gpteng|lovableproject|ai\.gateway\.lovable' --exclude-dir=docs --exclude-dir=.git --exclude=clean-clone-check.sh . ; then
  echo "Lovable references found"; exit 1
fi
echo "no Lovable tooling referenced"

step "repository layout (docs/development/repository-layout.md)"
expected=".git-blame-ignore-revs .github .gitignore .gitleaksignore .prettierignore Makefile README.md backend deploy docker-compose.yml docs e2e package-lock.json package.json scripts supabase web"
actual="$(git ls-files | cut -d/ -f1 | sort -u | tr '\n' ' ' | sed 's/ $//')"
[[ "$actual" == "$expected" ]] || { echo "unexpected root entries: $actual"; exit 1; }
[[ "$(git ls-files '*package-lock.json' | wc -l)" == 1 ]] || { echo "more than one lockfile"; exit 1; }
echo "root has only the documented entries; one lockfile"

step "install"
npm ci --no-audit --no-fund >/dev/null
(cd backend && uv sync --frozen >/dev/null 2>&1)

step "local database (docs/development/setup.md option B)"
export TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5434/love_islander_test
docker compose up -d --wait db >/dev/null 2>&1
make --no-print-directory migrate >/dev/null 2>&1
echo "migrated to $(PGPASSWORD=postgres psql -h localhost -p 5434 -U postgres -d love_islander -qAtc 'select version_num from alembic_version')"

step "make check (web + API)"
make --no-print-directory check 2>&1 | grep -E "All matched files|problems \(|Markdown files checked|Test Files|Tests  |built in|All checks passed|no issues found|passed in"

step "backup/restore and data-copy drills"
make --no-print-directory db-restore-drill 2>&1 | grep -E "^OK|drill passed"

step "images (deploy/web/Dockerfile, backend/Dockerfile)"
docker build -q -f deploy/web/Dockerfile --build-arg VITE_SUPABASE_URL=https://example.supabase.co \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=pk --build-arg VITE_API_URL=https://api.example.com -t clean-clone-web . >/dev/null
docker build -q -t clean-clone-api backend >/dev/null
echo "web and API images built"

step "database policy tests"
npm run -s test:db 2>&1 | grep -cE '^PASS' | sed 's/$/ policy suites passed/'

step "end-to-end (local Supabase + API + web)"
npm run -s test:e2e 2>&1 | grep -E "✓|✘|passed|failed"

step "clean-clone check passed"
