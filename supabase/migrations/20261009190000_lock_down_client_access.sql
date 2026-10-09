-- Browsers no longer read or write application data directly (#22): everything goes through the Love Islander API,
-- which connects with its own database role. Remove all client (anon/authenticated) privileges on application
-- tables and functions, stop broadcasting rows over Realtime, and drop the client storage policies (uploads use
-- API-issued signed upload URLs, which do not depend on them; public reads of profile photos are unaffected).
-- The RLS policies created by earlier migrations stay in place as a second layer.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, PUBLIC;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['messages', 'streaks'] LOOP
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
               AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END IF;
  END LOOP;
END
$$;

DROP POLICY IF EXISTS "profile-images owner can list" ON storage.objects;
DROP POLICY IF EXISTS "profile-images owner can insert" ON storage.objects;
DROP POLICY IF EXISTS "profile-images owner can update" ON storage.objects;
DROP POLICY IF EXISTS "profile-images owner can delete" ON storage.objects;
-- Names used by the first version of the bucket migration (normally already dropped by 20260519120247).
DROP POLICY IF EXISTS "Anyone can view profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile images" ON storage.objects;
