-- Streak count is computed by the database when a streak is posted (#5).

SELECT tests.create_user('alice@example.com', 'Alice') AS alice \gset

SET ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'alice', 'role', 'authenticated')::text, true);

-- First post: streak 1, regardless of what the client sends.
INSERT INTO public.streaks (user_id, content, streak_count, likes_count) VALUES (:'alice', '[]', 50, 1000);
SELECT tests.ok((SELECT streak_count FROM public.profiles WHERE id = :'alice') = 1, 'first post starts streak at 1');
SELECT tests.ok((SELECT max(likes_count) FROM public.streaks WHERE user_id = :'alice') = 0, 'client cannot seed likes');

-- Second post the same day: unchanged.
INSERT INTO public.streaks (user_id, content) VALUES (:'alice', '[]');
SELECT tests.ok((SELECT streak_count FROM public.profiles WHERE id = :'alice') = 1, 'same-day post keeps streak');
RESET ROLE;

-- Pretend the existing posts were made yesterday: next post extends the streak.
UPDATE public.streaks SET created_at = now() - interval '1 day' WHERE user_id = :'alice';
SET ROLE authenticated;
INSERT INTO public.streaks (user_id, content) VALUES (:'alice', '[]');
SELECT tests.ok((SELECT streak_count FROM public.profiles WHERE id = :'alice') = 2, 'consecutive day extends streak');
RESET ROLE;

-- After a missed day the streak restarts.
UPDATE public.streaks SET created_at = now() - interval '3 days' WHERE user_id = :'alice';
SET ROLE authenticated;
INSERT INTO public.streaks (user_id, content) VALUES (:'alice', '[]');
SELECT tests.ok((SELECT streak_count FROM public.profiles WHERE id = :'alice') = 1, 'missed day resets streak');
SELECT tests.ok((SELECT streak_count FROM public.streaks WHERE user_id = :'alice' ORDER BY created_at DESC LIMIT 1) = 1,
                'post records the computed streak');
RESET ROLE;
