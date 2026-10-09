-- Settings preferences and user reports (#17). Mirrored by Alembic revision 0002.

-- Display/AI preferences shown in Settings (validated by the API); the existing columns keep the stored settings.
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Reports of other users, reviewed by moderators with the service role.
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reports_reason_check CHECK (reason = ANY (ARRAY['harassment'::text, 'spam'::text, 'fake_profile'::text,
    'inappropriate_content'::text, 'underage'::text, 'other'::text])),
  CONSTRAINT reports_status_check CHECK (status = ANY (ARRAY['open'::text, 'reviewing'::text, 'resolved'::text,
    'dismissed'::text])),
  CONSTRAINT reports_not_self CHECK (reporter_id <> reported_user_id)
);
CREATE INDEX IF NOT EXISTS reports_reported_user_idx ON public.reports (reported_user_id, created_at);
CREATE INDEX IF NOT EXISTS reports_reporter_idx ON public.reports (reporter_id);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can file reports" ON public.reports;
CREATE POLICY "Users can file reports" ON public.reports
FOR INSERT TO authenticated
WITH CHECK (reporter_id = auth.uid() AND status = 'open');
DROP POLICY IF EXISTS "Users can see their own reports" ON public.reports;
CREATE POLICY "Users can see their own reports" ON public.reports
FOR SELECT TO authenticated
USING (reporter_id = auth.uid());
