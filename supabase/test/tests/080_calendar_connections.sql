-- Calendar tokens are never readable or writable by clients (#20).
SELECT tests.create_user('a@example.com') AS a \gset
INSERT INTO public.calendar_connections (user_id, refresh_token_encrypted) VALUES (:'a', 'ciphertext');
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'a', 'role', 'authenticated')::text, true);
SELECT tests.ok(tests.row_count('SELECT * FROM public.calendar_connections') = 0, 'even the owner cannot read tokens directly');
SELECT tests.throws(format('INSERT INTO public.calendar_connections (user_id, refresh_token_encrypted) VALUES (%L, %L)', :'a', 'x'),
                    'row-level security', 'clients cannot store tokens');
RESET ROLE;
