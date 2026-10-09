-- Notifications are private to their recipient and written only by the API (#18).
SELECT tests.create_user('a@example.com') AS a \gset
SELECT tests.create_user('b@example.com') AS b \gset
INSERT INTO public.notifications (user_id, type, actor_id) VALUES (:'a', 'match', :'b');

SET ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'b', 'role', 'authenticated')::text, true);
SELECT tests.ok(tests.row_count('SELECT * FROM public.notifications') = 0, 'others cannot read my notifications');
SELECT tests.throws(format('INSERT INTO public.notifications (user_id, type) VALUES (%L, %L)', :'a', 'match'),
                    'row-level security', 'clients cannot create notifications');
SELECT set_config('request.jwt.claims', json_build_object('sub', :'a', 'role', 'authenticated')::text, true);
SELECT tests.ok(tests.row_count('SELECT * FROM public.notifications') = 1, 'recipient can read');
RESET ROLE;
