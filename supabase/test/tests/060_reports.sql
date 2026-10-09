-- Reports: users can file and read only their own; status is set by moderators (#17).
SELECT tests.create_user('a@example.com') AS a \gset
SELECT tests.create_user('b@example.com') AS b \gset
SELECT tests.create_user('c@example.com') AS c \gset

SET ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'a', 'role', 'authenticated')::text, true);
INSERT INTO public.reports (reporter_id, reported_user_id, reason) VALUES (:'a', :'b', 'spam');
SELECT tests.throws(format('INSERT INTO public.reports (reporter_id, reported_user_id, reason) VALUES (%L, %L, %L)', :'c', :'b', 'spam'),
                    'row-level security', 'cannot file a report as someone else');
SELECT tests.throws(format('INSERT INTO public.reports (reporter_id, reported_user_id, reason, status) VALUES (%L, %L, %L, %L)', :'a', :'b', 'spam', 'dismissed'),
                    'row-level security', 'cannot set a moderation status');
SELECT tests.throws(format('INSERT INTO public.reports (reporter_id, reported_user_id, reason) VALUES (%L, %L, %L)', :'a', :'b', 'because'),
                    'reports_reason_check', 'reason must be a known value');

SELECT set_config('request.jwt.claims', json_build_object('sub', :'b', 'role', 'authenticated')::text, true);
SELECT tests.ok(tests.row_count('SELECT * FROM public.reports') = 0, 'reported user cannot see the report');
RESET ROLE;
