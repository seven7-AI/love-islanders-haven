# Observability

## Logs
The API writes one JSON object per line to stdout (`LOG_JSON=true`, the default). Every request produces an `event:
"request"` line with `method`, `path`, `status`, `duration_ms`, `request_id` and, for signed-in requests, `user_id`.
Handler logs in the same request carry the same `request_id`/`user_id`. The `X-Request-ID` response header returns the
id (a valid incoming one is reused), so a user-reported error can be matched to its logs.
Unhandled errors are logged as `unhandled_error` with the exception type; clients get a generic 500 problem response.

Ship stdout to the hosting platform's log store; no log files are written.

## Metrics
`GET /metrics` serves Prometheus metrics:
- `http_requests_total{method, route, status}` — `route` is the route template (e.g. `/v1/matches/{match_id}/messages`)
- `http_request_duration_seconds{method, route}` — latency histogram

Set `METRICS_TOKEN` in any internet-facing deployment; the endpoint then requires `Authorization: Bearer <token>`.
Suggested alerts: 5xx ratio > 1% over 5 min; p95 latency of `/v1/discover` or `/v1/matches/{match_id}/messages`
> 1 s; `/readyz` failing.

## Health
- `GET /healthz` — the process is running (liveness).
- `GET /readyz` — the database answers (readiness; 503 otherwise). Use it for load-balancer health checks.

## Error tracking
Set `SENTRY_DSN` (and optionally `SENTRY_TRACES_SAMPLE_RATE`) to report unhandled API errors to Sentry. Personal data
(request bodies, emails) is not sent. The web app catches render errors with an error boundary that offers a reload
instead of a blank page; browser error reporting is not configured.
