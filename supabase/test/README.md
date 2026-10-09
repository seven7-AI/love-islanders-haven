# Database policy tests

`run.sh` starts a throwaway `postgres:15-alpine` container, loads `bootstrap.sql` (a minimal emulation of the Supabase
roles, `auth.users`, `auth.uid()`, `storage` tables and the realtime publication), applies every file in
`supabase/migrations` in order, loads `helpers.sql`, and runs each file in `tests/` inside its own rolled-back transaction.

```bash
npm run test:db            # needs Docker and psql
PGHOST=... PGUSER=... PGPASSWORD=... PGDATABASE=... supabase/test/run.sh   # use an existing empty database
```

Tests switch to the `anon`, `authenticated` or `service_role` role and set `request.jwt.claims` exactly as PostgREST does,
so row-level security and triggers behave as they do for real API requests. Helpers:

- `tests.create_user(email, name, confirmed)` – inserts into `auth.users` (fires the sign-up triggers) and returns the id
- `tests.ok(condition, message)` – fails the test unless the condition is true
- `tests.throws(sql, expected_error_substring, message)` – fails unless the statement errors with that message
- `tests.row_count(sql)` – rows visible to the current role

The stubs are a test substitute for the Supabase platform, not the platform itself: Supabase Auth, Storage and Realtime
behaviour beyond what the migrations reference is not covered here.
