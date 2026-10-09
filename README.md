# Love Islander

A dating app: profiles, discovery and swiping, matches and chat, streaks, an AI companion, and safety tools.

Frontend: Vite + React 18 + TypeScript, Tailwind and shadcn/ui, with a Capacitor shell for Android/iOS.
Backend today: Supabase (Postgres, Auth, Storage, edge functions in `supabase/functions`).
A FastAPI + Postgres + Alembic backend is being introduced. See [docs/STATUS.md](docs/STATUS.md) for progress and [docs/audit/2026-10-audit.md](docs/audit/2026-10-audit.md) for the current-state audit.

## Requirements
- Node.js 20+ and npm (use `npm ci`; `package-lock.json` is the only lockfile)
- A Supabase project (URL and publishable key)

## Getting started
```bash
npm ci
cp .env.example .env   # fill in VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev            # http://localhost:8080
```

## Checks
```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Mobile
`npm run build && npx cap sync android`, then see [docs/mobile/](docs/mobile/) and `npm run android:deploy`.
Before the first store release the Capacitor `appId` in `capacitor.config.ts` must be set to the owner's final application id.
