-- Google Calendar connections (#20). Tokens are encrypted by the API before storage; clients have no access.
-- Mirrored by Alembic revision 0004.
CREATE TABLE IF NOT EXISTS public.calendar_connections (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google',
  refresh_token_encrypted text NOT NULL,
  scope text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_connections_provider_check CHECK (provider = 'google'::text)
);
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;
-- No policies: only the API (service role) reads or writes this table.
