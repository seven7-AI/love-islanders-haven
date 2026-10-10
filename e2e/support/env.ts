/**
 * Endpoints of the local stack started by scripts/e2e.sh: Supabase CLI (real Auth and Storage), the Love Islander API
 * (on its own Alembic-managed Postgres), and the web dev server. The keys are the Supabase CLI's fixed
 * local-development defaults, not secrets.
 */
export const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321';
export const ANON_KEY = process.env.E2E_SUPABASE_ANON_KEY ?? '';
export const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? '';
export const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? 'http://127.0.0.1:54324';
export const API_URL = process.env.E2E_API_URL ?? 'http://127.0.0.1:8001';
export const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:8080';
