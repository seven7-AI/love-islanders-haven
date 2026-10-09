-- After the lockdown migration, client roles cannot read or write any application table (#22).
SELECT tests.create_user('a@example.com') AS a \gset

DO $$
DECLARE
  t record;
  bad text[] := '{}';
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    IF has_table_privilege('authenticated', format('public.%I', t.tablename), 'SELECT,INSERT,UPDATE,DELETE')
       OR has_table_privilege('anon', format('public.%I', t.tablename), 'SELECT,INSERT,UPDATE,DELETE')
       OR EXISTS (SELECT 1 FROM information_schema.column_privileges
                  WHERE table_schema = 'public' AND table_name = t.tablename AND grantee IN ('anon', 'authenticated'))
    THEN
      bad := bad || t.tablename;
    END IF;
  END LOOP;
  PERFORM tests.ok(cardinality(bad) = 0, 'client roles still have privileges on: ' || array_to_string(bad, ', '));
END
$$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'a', 'role', 'authenticated')::text, true);
SELECT tests.throws('SELECT id FROM public.profiles', 'permission denied', 'profiles not readable');
SELECT tests.throws(format('INSERT INTO public.ai_chat_history (user_id, role, message_content) VALUES (%L, %L, %L)', :'a', 'assistant', 'fake'),
                    'permission denied', 'cannot forge companion messages');
SELECT tests.throws(format('SELECT public.is_blocked_pair(%L, %L)', :'a', :'a'), 'permission denied', 'helper functions not callable');
RESET ROLE;

SELECT tests.ok(NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public'),
                'no application tables broadcast over Realtime');
SELECT tests.ok(NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'),
                'no client storage policies remain (uploads use API-signed URLs)');

-- Sign-up still creates profiles through the auth trigger.
SELECT tests.ok(EXISTS (SELECT 1 FROM public.profiles WHERE id = :'a'), 'auth trigger still creates the profile');
