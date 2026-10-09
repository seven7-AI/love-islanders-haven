-- Exact coordinates are not readable by client roles (#21).
SELECT tests.create_user('a@example.com') AS a \gset
SELECT tests.create_user('b@example.com') AS b \gset
UPDATE public.profiles SET latitude = -1.29, longitude = 36.82 WHERE id = :'a';

SET ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'b', 'role', 'authenticated')::text, true);
SELECT tests.throws(format('SELECT latitude FROM public.profiles WHERE id = %L', :'a'), 'permission denied',
                    'other users cannot read coordinates');
SELECT tests.throws(format('SELECT * FROM public.profiles WHERE id = %L', :'a'), 'permission denied',
                    'select * cannot be used to read coordinates either');
SELECT tests.ok(tests.row_count(format('SELECT id, name FROM public.profiles WHERE id = %L', :'a')) = 1,
                'other profile columns stay readable');
SELECT tests.throws(format('UPDATE public.profiles SET latitude = 0, longitude = 0 WHERE id = %L', :'b'),
                    'permission denied', 'clients cannot write coordinates directly');
RESET ROLE;
