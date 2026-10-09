-- The #7 migration's duplicate-merge logic, replayed: messages from a reversed duplicate move to the kept match.
SELECT tests.create_user('a@example.com') AS a \gset
SELECT tests.create_user('b@example.com') AS b \gset
DROP INDEX public.matches_pair_unique;
INSERT INTO public.matches (id, user_id, matched_user_id, status, created_at) VALUES
  ('00000000-0000-0000-0000-000000000001', :'a', :'b', 'active', now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000000002', :'b', :'a', 'active', now() - interval '1 day');
INSERT INTO public.messages (match_id, sender_id, content) VALUES
  ('00000000-0000-0000-0000-000000000001', :'a', 'one'),
  ('00000000-0000-0000-0000-000000000002', :'b', 'two');

\i supabase/migrations/20261009130000_enforce_matching_rules.sql

SELECT tests.ok((SELECT count(*) FROM public.matches) = 1, 'duplicates merged');
SELECT tests.ok((SELECT id FROM public.matches) = '00000000-0000-0000-0000-000000000001', 'oldest match kept');
SELECT tests.ok((SELECT count(*) FROM public.messages WHERE match_id = '00000000-0000-0000-0000-000000000001') = 2, 'messages preserved');
