-- Profile image visibility (#5).

SELECT tests.create_user('alice@example.com', 'Alice') AS alice \gset
SELECT tests.create_user('bob@example.com', 'Bob') AS bob \gset

INSERT INTO public.profile_images (profile_id, url, position, is_visible) VALUES
  (:'alice', 'https://img/visible.jpg', 0, true),
  (:'alice', 'https://img/hidden.jpg', 1, false);

SET ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'bob', 'role', 'authenticated')::text, true);
SELECT tests.ok(tests.row_count(format('SELECT * FROM public.profile_images WHERE profile_id = %L', :'alice')) = 1,
                'others see only visible images');
SELECT tests.ok(tests.row_count(format('SELECT * FROM public.profile_images WHERE profile_id = %L AND NOT is_visible', :'alice')) = 0,
                'hidden image not readable by others');

SELECT set_config('request.jwt.claims', json_build_object('sub', :'alice', 'role', 'authenticated')::text, true);
SELECT tests.ok(tests.row_count(format('SELECT * FROM public.profile_images WHERE profile_id = %L', :'alice')) = 2,
                'owner sees hidden images');
RESET ROLE;

SET ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT tests.ok(tests.row_count('SELECT * FROM public.profile_images') = 0, 'anon sees no image rows');
RESET ROLE;
