# Repository layout

This document records how the repository is organised, what references what, and the rules any future move has to
respect. It was written before the root-directory reorganization (issues #62–#68), and each of those issues updates
it as files move.

## Root inventory before the reorganization
These are the tracked files and directories at the root as of `557f50d`.

| Entry | Purpose | Consumed by |
|---|---|---|
| `.github/workflows/ci.yml` | The only workflow, with jobs `web`, `security`, `database`, `backend` and `e2e` | GitHub Actions; branch protection |
| `backend/` | FastAPI API, Alembic, tests, `Dockerfile` (build context `backend/`) | CI `backend`, `Makefile`, `docker-compose.yml`, `scripts/e2e.sh`, `scripts/db/*-drill.sh` |
| `deploy/web/` | Web `Dockerfile` (build context = repository root) and nginx templates | CI `web` (image build), `docs/deployment.md` |
| `docs/` | Documentation | README, `backend/README.md`, comments in scripts and configs |
| `e2e/` | Playwright specs and helpers for the whole stack (imports nothing from `src/`) | `playwright.config.ts`, `scripts/e2e.sh` |
| `public/` | Static web assets | Vite (`index.html`), Capacitor config |
| `scripts/` | `e2e.sh` and `clean-clone-check.sh` (repository tooling), `android-deploy.cjs` (mobile), `db/` (database operations and drills) | `package.json`, `Makefile`, CI, docs |
| `src/` | React application | Vite, Vitest, TypeScript, ESLint, Tailwind |
| `supabase/` | Supabase CLI project: `config.toml`, the frozen `migrations/`, and policy tests in `test/` | `scripts/e2e.sh` (CLI), CI `database`, `backend/tests/test_migrations.py`, `scripts/db/copy-drill.sh` |
| `.dockerignore` | Ignore rules for the web image build (root context) | `docker build -f deploy/web/Dockerfile .` |
| `.env.example` | Web environment template (`VITE_*`) | Vite reads `.env*` from its root |
| `.git-blame-ignore-revs` | Formatting commit skipped by blame | git and GitHub (only at the root) |
| `.gitignore` | Ignore rules; patterns without a slash match at any depth | git |
| `.gitleaksignore` | Baselined historical findings, as commit-bound fingerprints | gitleaks (CI `security`, `make security-check`) |
| `.prettierignore`, `.prettierrc.json` | Prettier scope and style for the whole repository | `npm run format:check` (CI `web`) |
| `Makefile` | Task runner across web, API and database | developers, `scripts/clean-clone-check.sh` |
| `README.md` | Project entry point | |
| `docker-compose.yml` | Local Postgres and API (`./backend`, `./backend/scripts/create-test-db.sql`) | `Makefile`, `scripts/clean-clone-check.sh` |
| `package.json`, `package-lock.json` | Web dependencies plus repository-wide scripts (`test:db`, `test:e2e`, `android:deploy`) | npm, CI, `Makefile` |
| `index.html` | Vite entry (`/src/main.tsx`) | Vite |
| `vite.config.ts`, `vitest.config.ts` | Build and unit-test config (`@` → `./src`) | Vite, Vitest |
| `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` | TypeScript project references | `npm run typecheck`, editors |
| `tailwind.config.ts`, `postcss.config.js`, `components.json` | Styling and shadcn/ui generator config | Vite (PostCSS), shadcn CLI |
| `eslint.config.js` | Lint rules, including the ban on direct Supabase data access | `npm run lint` |
| `capacitor.config.ts` | Native shell config (`webDir: dist`) | Capacitor CLI, `scripts/android-deploy.cjs` |
| `playwright.config.ts` | E2E config (`testDir: e2e`) | `scripts/e2e.sh` |

That is 24 files and 8 directories. Fourteen of the files belong only to the web app.

Not tracked, and kept out of git by `.gitignore` or `.git/info/exclude`: `node_modules/`, `dist/`, `test-results/`,
`playwright-report/`, `.env*`, `backend/.venv`, and local tool state.

## Constraints any move must respect
- **CI check names are fixed.** Branch protection requires these five checks by name:
  - `Web (lint, typecheck, test, build)`
  - `Security (dependencies, secrets)`
  - `Database (migrations + policy tests)`
  - `Backend (ruff, mypy, pytest)`
  - `End-to-end (Playwright on local Supabase + API + web)`

  Steps can change; names cannot.
- **`supabase/` stays at the root.** The Supabase CLI looks for `supabase/config.toml` in its working directory
  (`scripts/e2e.sh` runs it from the root). `supabase start` applies `supabase/migrations`, which create the
  `profile-images` and `chat-media` buckets the E2E photo and chat tests use.
- **Some scripts locate files by fixed relative paths:**
  - `scripts/e2e.sh` runs `cd "$(dirname "$0")/.."`.
  - `scripts/db/restore-drill.sh` and `copy-drill.sh` use `root="$here/../.."`.
  - `supabase/test/run.sh` uses `$here/../migrations`.
  - `backend/tests/test_migrations.py` uses `BACKEND_DIR.parent / "supabase"`.
- **Some tools are sensitive to the working directory:**
  - Tailwind 3 resolves `content` globs against the current working directory.
  - Vite reads `.env*` from its project root.
  - Capacitor resolves `webDir` and native folders next to its config.
  - So web commands must run with the web app's directory as the working directory.
- **`.gitleaksignore` entries are commit-bound fingerprints** (`<commit>:<path>:<rule>:<line>`). They refer to the
  paths as they were in those commits and must not be rewritten after a move.
- **Prettier's scope covers more than the web app:** it also checks `.github/workflows/ci.yml`,
  `docker-compose.yml` and `e2e/`. Its config has to stay where it can reach those.
- **The web image build uses the repository root as context.** Its ignore file has to follow the build when the
  manifests move.

## Target layout
```
.github/workflows/ci.yml
backend/        FastAPI API (unchanged)
web/            React + Vite + Capacitor app with its own package.json and configs, .env.example, scripts/android-deploy.cjs
e2e/            Playwright workspace: package.json, playwright.config.ts, tsconfig.json, specs, support/
supabase/       Supabase CLI project: config.toml, frozen migrations/, policy tests (test/)
deploy/web/     Web Dockerfile, Dockerfile.dockerignore, nginx templates
scripts/        Repository tooling: e2e.sh, clean-clone-check.sh, db/
docs/           Index, architecture, deployment, security, development/, api/, database/, operations/, mobile/, audit/
Makefile  README.md  docker-compose.yml  package.json (npm workspaces root)  package-lock.json
.gitignore  .gitleaksignore  .git-blame-ignore-revs  .prettierignore
```
- **The root `package.json`** is a private npm-workspaces root (`web`, `e2e`) with one lockfile. It holds Prettier
  (with its config in the `prettier` key) and scripts that delegate to the workspaces, so `npm run build`,
  `npm test`, `npm run test:e2e` and the other commands keep working from the root.
- **Web commands** run inside `web/` (`npm run <script> -w web`), which satisfies the Tailwind, Vite and Capacitor
  working-directory rules.
- **The web image** keeps the root as its build context, with a Dockerfile-specific ignore file next to the Dockerfile.
- **Files are moved with `git mv`**, so history follows them (`git log --follow`).

## Order of work
1. #62: this inventory and the target layout.
2. #63: remove stale configuration and tracked CLI state, and make the policy tests independent of the working
   directory. Nothing moves in this step.
3. #64: move the web app into `web/` and turn the root into an npm-workspaces root.
4. #65: make `e2e/` its own workspace, with its own config and type checking.
5. #66: add a docs index and regroup the docs under `docs/development/`, stating each fact once.
6. #67: add a generated API reference (`docs/api/`).
7. #68: verify the documented workflow from a clean clone.
