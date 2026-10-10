# API reference

The complete reference is the OpenAPI document [`openapi.json`](openapi.json). It is generated from the code and lists
every endpoint, parameter and request/response schema. To browse it:
- run the API locally (not in production) and open `http://localhost:8000/docs`; or
- open `openapi.json` in any OpenAPI viewer, e.g. `npx @redocly/cli preview-docs docs/api/openapi.json`.

To regenerate it after an API change, run `make api-docs`. `backend/tests/test_openapi_docs.py` fails while the
committed document is out of date, so CI catches a forgotten regeneration.

## Endpoint groups
| Tag | Paths | Purpose |
|---|---|---|
| health | `/healthz`, `/readyz` | Liveness and database readiness (no auth). `/metrics` (Prometheus) is not part of the document |
| me, profiles | `/v1/me…`, `/v1/profiles/{id}` | Account bootstrap, own profile, onboarding, photos (signed uploads), location, public profiles |
| discovery | `/v1/discover`, `/v1/swipes`, `/v1/matches…` | Candidate feed, swipes, mutual matches |
| messages | `/v1/matches/{id}/messages`, `…/media/uploads`, `…/read` | Chat, chat media, read receipts |
| streaks | `/v1/streaks…` | Daily photo posts, likes, own status, leaderboard |
| settings & safety | `/v1/me/settings`, `/v1/blocks…`, `/v1/reports`, `/v1/safety-contacts…`, `/v1/date-plans…`, `/v1/safety/alerts` | Preferences, blocking, reporting, safety tools |
| notifications | `/v1/notifications…` | In-app notifications and read state |
| ai companion | `/v1/companion/messages` | AI dating companion chat |
| google calendar | `/v1/integrations/google-calendar…` | Connect, authorize, callback, events |
| insights & feedback | `/v1/me/insights`, `/v1/feedback` | Activity insights and feedback |

## Conventions
- **Authentication:** `Authorization: Bearer <Supabase access token>` on every `/v1` endpoint. The API verifies the
  token and takes the user from its `sub`; request bodies never carry user ids. A missing or invalid token gives
  `401` with `WWW-Authenticate: Bearer`.
- **Errors:** every error is an RFC 9457 problem document (`application/problem+json`) with `type`, `title`,
  `status`, an optional `detail` and, for expected failures, a stable `code` (for example `rate_limited`,
  `storage_not_configured`, `ai_not_configured`, `calendar_not_configured`, `alerts_not_configured`).
  - Validation failures are `422` with an `errors` list of `{loc, msg, type}`.
  - The generated document shows FastAPI's default `HTTPValidationError` shape for `422` responses, but the actual
    body is the problem document described here.
- **Pagination:** list endpoints take `limit` and return an opaque `next_cursor`, which is passed back as `cursor` to
  get the next page. Chat history is different: it returns `older_cursor`, which is passed back as `before` for older
  messages, and `after=<timestamp>` polls for new ones. A `null` cursor means there are no more pages.
- **Rate limits:** write endpoints are limited per user. Exceeding a limit gives `429` with `code: rate_limited` and a
  `Retry-After` header.
- **Request ids:** every response carries `X-Request-ID`. Send your own to correlate client and server logs.
- **Unconfigured integrations:** endpoints that need Storage, the LLM or Google answer `503` with a `*_not_configured`
  code instead of simulating success. See [external services](../external-services.md).
