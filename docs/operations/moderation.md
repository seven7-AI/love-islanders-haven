# Moderation

Users report other users from a chat (Report, optionally also blocking them). Reports are reviewed by moderators.

## Granting and revoking the moderator role
Roles are stored in the `user_roles` table and change only through the operator CLI, run with the API's environment
(the same `DATABASE_URL`, and for `--email` also `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`). No API endpoint
can grant or revoke a role.

```
# from backend/, or inside the API container
uv run python -m app.admin roles grant --email moderator@example.com --by "your name"
uv run python -m app.admin roles revoke --email moderator@example.com
uv run python -m app.admin roles list
```

`--user-id <uuid>` works instead of `--email`. The person must have signed in to the app once, so that their
profile exists. `--by` is recorded with the grant; it defaults to your OS user name.

## Reviewing reports
Moderators see **Moderation** in the navigation bar and land on `/moderation` after signing in when they have no
dating profile. The page lists the queue by status (Open by default), and **Review** opens a report to mark it
reviewing, resolve it or dismiss it with a note. Everyone else gets "Moderators only", and the API answers `403`.

`GET /v1/moderation/reports` lists reports oldest first, optionally filtered by `status` (`open`, `reviewing`,
`resolved`, `dismissed`). Each report shows the reporter, the reported person and how many reports there are
against them in total.

`PATCH /v1/moderation/reports/{id}` sets the status to `reviewing`, `resolved` or `dismissed`, with an optional
`resolution_note` (up to 1000 characters). Leaving the note out keeps the earlier one. Every change records the
moderator (`reviewed_by`) and the time (`reviewed_at`). A report cannot be set back to `open`. Moderators cannot
review reports that they filed or that are about them (`403 conflict_of_interest`).

Reviewing a report records a decision. It does not act on the reported account: there is no suspension or ban
feature yet. Reporting already blocks the reported person for the reporter when they choose to.
