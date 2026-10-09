# Security

## Model
- **Identity:** Supabase Auth issues access tokens; the API verifies them (JWKS or legacy secret) and takes the user id
  only from the token. Request bodies never carry user ids.
- **Data access:** browsers talk to the Love Islander API only. After migration `20261009190000_lock_down_client_access`
  client roles have no privileges on application tables or functions; RLS policies remain as a second layer.
- **Files:** profile and streak photos live in the public `profile-images` bucket (URLs are unguessable but not secret);
  chat media lives in the private `chat-media` bucket and is served through one-hour signed URLs. Uploads use signed
  upload URLs issued by the API after checking type, size, ownership and limits.
- **Third-party tokens:** Google refresh tokens are encrypted with Fernet (`TOKEN_ENCRYPTION_KEY`); OAuth state is
  HMAC-signed, expires in 10 minutes and is bound to the user who started the flow.
- **Abuse controls:** per-user rate limits on write endpoints (in-memory, per instance; see `app/core/rate_limit.py`),
  database-enforced AI companion quota, 1 MB request-body limit, report and block flows.
- **Headers:** the API sends `nosniff`, `X-Frame-Options: DENY`, a `default-src 'none'` CSP, `no-store` on `/v1/*`, and
  HSTS in production. Production refuses wildcard or non-https CORS origins. Web hosting headers: see
  `docs/deployment.md`.

## Automated checks (CI job "Security")
| Check | Blocking | Notes |
|---|---|---|
| `npm audit --omit=dev --audit-level=high` | yes | runtime dependencies (currently 0 advisories) |
| `npm audit --audit-level=high` | no | dev/build tooling; see accepted risks |
| `pip-audit` on the locked backend requirements | yes | |
| `gitleaks` over the full git history | yes | known historical findings listed in `.gitleaksignore` |

Run locally: `npm audit --omit=dev`, `cd backend && uv export --frozen --format requirements-txt --no-hashes > /tmp/r.txt && uvx pip-audit -r /tmp/r.txt`,
`docker run --rm -v "$PWD:/repo" ghcr.io/gitleaks/gitleaks:v8.21.2 git /repo --redact`.

## Accepted risks
- **Tailwind CSS 3 build chain** (`braces`, `micromatch`, `chokidar`, `fast-glob`, `postcss-selector-parser`): denial of
  service through crafted glob/selector patterns. These run only at build time on patterns in this repository; there is
  no fixed Tailwind 3 release. Resolved by migrating to Tailwind 4.
- **Rate limits are per API instance**; with several instances a user can exceed a limit by that factor.

## Secrets found in git history
| Finding | Status | Action |
|---|---|---|
| Supabase publishable (anon) key in `.env` and an old `client.ts` | Public by design | none; `.env` is no longer tracked |
| **Spotify client id and secret** in `src/hooks/use-song-search.ts` (commit `370a20d`, feature removed in `b1aa612`) | **Exposed in public history** | **Owner must rotate the Spotify app's client secret** in the Spotify developer dashboard (or delete the app). Rewriting git history would not remove existing copies. |

## Reporting
Report vulnerabilities privately to the repository owner rather than in public issues.
