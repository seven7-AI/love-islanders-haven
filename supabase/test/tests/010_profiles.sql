-- Profile creation, read access and server-managed columns (#5).

SELECT tests.create_user('alice@example.com', 'Alice') AS alice \gset
SELECT tests.create_user('bob@example.com', NULL, false) AS bob \gset

-- Sign-up creates the profile and onboarding rows server-side.
SELECT tests.ok((SELECT name FROM public.profiles WHERE id = :'alice') = 'Alice', 'profile created with name from metadata');
SELECT tests.ok((SELECT name FROM public.profiles WHERE id = :'bob') = 'bob', 'name falls back to email local part');
SELECT tests.ok(EXISTS (SELECT 1 FROM public.profile_onboarding WHERE profile_id = :'alice'), 'onboarding row created');

-- email_verified mirrors auth.users.email_confirmed_at.
SELECT tests.ok((SELECT email_verified FROM public.profiles WHERE id = :'alice'), 'confirmed user is email_verified');
SELECT tests.ok(NOT (SELECT email_verified FROM public.profiles WHERE id = :'bob'), 'unconfirmed user is not email_verified');
UPDATE auth.users SET email_confirmed_at = now() WHERE id = :'bob';
SELECT tests.ok((SELECT email_verified FROM public.profiles WHERE id = :'bob'), 'confirming the email updates the profile');

-- Emails are not duplicated into profiles.
SELECT tests.ok(NOT EXISTS (SELECT 1 FROM information_schema.columns
                            WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email'),
                'profiles has no email column');

-- Anonymous visitors cannot read profiles.
SET ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT tests.ok(tests.row_count('SELECT * FROM public.profiles') = 0, 'anon sees no profiles');
RESET ROLE;

-- Signed-in users can read other profiles.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'alice', 'role', 'authenticated')::text, true);
SELECT tests.ok(tests.row_count(format('SELECT * FROM public.profiles WHERE id = %L', :'bob')) = 1, 'authenticated user sees other profiles');

-- Users can edit ordinary fields of their own profile...
UPDATE public.profiles SET bio = 'hello' WHERE id = :'alice';
SELECT tests.ok((SELECT bio FROM public.profiles WHERE id = :'alice') = 'hello', 'own bio updated');

-- ...but not server-managed fields.
SELECT tests.throws(format('UPDATE public.profiles SET verified = true WHERE id = %L', :'alice'), 'managed by the server', 'cannot self-verify');
SELECT tests.throws(format('UPDATE public.profiles SET email_verified = false WHERE id = %L', :'alice'), 'managed by the server', 'cannot change email_verified');
SELECT tests.throws(format('UPDATE public.profiles SET streak_count = 99 WHERE id = %L', :'alice'), 'managed by the server', 'cannot set streak_count');

-- ...and not other people's profiles (RLS filters the row; nothing changes).
UPDATE public.profiles SET bio = 'hacked' WHERE id = :'bob';
RESET ROLE;
SELECT tests.ok((SELECT bio FROM public.profiles WHERE id = :'bob') IS DISTINCT FROM 'hacked', 'cannot edit another profile');

-- Age is derived from date of birth, and under-18s are rejected.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'alice', 'role', 'authenticated')::text, true);
UPDATE public.profiles SET dob = (current_date - interval '30 years')::date, age = 99 WHERE id = :'alice';
SELECT tests.ok((SELECT age FROM public.profiles WHERE id = :'alice') = 30, 'age computed from dob');
SELECT tests.throws(format('UPDATE public.profiles SET dob = %L WHERE id = %L', (current_date - interval '17 years')::date, :'alice'),
                    'at least 18', 'under-18 dob rejected');
RESET ROLE;

-- The service role (server code) can still manage these fields.
SET ROLE service_role;
UPDATE public.profiles SET verified = true WHERE id = :'alice';
RESET ROLE;
SELECT tests.ok((SELECT verified FROM public.profiles WHERE id = :'alice'), 'service role can verify');

-- An unconfirmed user cannot mark themselves verified either.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'bob', 'role', 'authenticated')::text, true);
RESET ROLE;
UPDATE auth.users SET email_confirmed_at = NULL WHERE id = :'bob';
SET ROLE authenticated;
SELECT tests.throws(format('UPDATE public.profiles SET email_verified = true WHERE id = %L', :'bob'), 'managed by the server',
                    'unconfirmed user cannot set email_verified');
RESET ROLE;
