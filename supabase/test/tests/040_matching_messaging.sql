-- Matches come only from mutual swipes; messaging requires an active, unblocked match (#7).

SELECT tests.create_user('alice@example.com', 'Alice') AS alice \gset
SELECT tests.create_user('bob@example.com', 'Bob') AS bob \gset
SELECT tests.create_user('carol@example.com', 'Carol') AS carol \gset

-- Users cannot create or edit matches directly.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'carol', 'role', 'authenticated')::text, true);
SELECT tests.throws(format('INSERT INTO public.matches (user_id, matched_user_id, status) VALUES (%L, %L, %L)', :'carol', :'alice', 'active'),
                    'row-level security', 'direct match insert rejected');
RESET ROLE;

-- A mutual right swipe creates exactly one active match.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'alice', 'role', 'authenticated')::text, true);
INSERT INTO public.swipes (user_id, swiped_user_id, direction) VALUES (:'alice', :'bob', 'right');
SELECT set_config('request.jwt.claims', json_build_object('sub', :'bob', 'role', 'authenticated')::text, true);
INSERT INTO public.swipes (user_id, swiped_user_id, direction) VALUES (:'bob', :'alice', 'right');
RESET ROLE;
SELECT tests.ok((SELECT count(*) FROM public.matches
                 WHERE least(user_id, matched_user_id) = least(:'alice'::uuid, :'bob'::uuid)
                   AND greatest(user_id, matched_user_id) = greatest(:'alice'::uuid, :'bob'::uuid)) = 1,
                'one match for a mutual swipe');
SELECT id AS match_id FROM public.matches WHERE user_id IN (:'alice', :'bob') AND matched_user_id IN (:'alice', :'bob') \gset
SELECT tests.ok((SELECT status FROM public.matches WHERE id = :'match_id') = 'active', 'match is active');

-- The reversed pair cannot be inserted again, even by the server.
SELECT tests.throws(format('INSERT INTO public.matches (user_id, matched_user_id, status) VALUES (%L, %L, %L)', :'bob', :'alice', 'active'),
                    'duplicate key', 'reversed duplicate match rejected');

-- Match members can edit nothing on the match.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'alice', 'role', 'authenticated')::text, true);
UPDATE public.matches SET matched_user_id = :'carol' WHERE id = :'match_id';
RESET ROLE;
SELECT tests.ok((SELECT matched_user_id IN (:'alice', :'bob') FROM public.matches WHERE id = :'match_id'), 'match cannot be retargeted');

-- Members can message; outsiders cannot.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'alice', 'role', 'authenticated')::text, true);
INSERT INTO public.messages (match_id, sender_id, content) VALUES (:'match_id', :'alice', 'hi bob');
SELECT set_config('request.jwt.claims', json_build_object('sub', :'carol', 'role', 'authenticated')::text, true);
SELECT tests.throws(format('INSERT INTO public.messages (match_id, sender_id, content) VALUES (%L, %L, %L)', :'match_id', :'carol', 'hey'),
                    'row-level security', 'non-member cannot message');
SELECT tests.ok(tests.row_count('SELECT * FROM public.messages') = 0, 'non-member cannot read messages');

-- Read receipts: the recipient can mark a message read; nobody can rewrite content.
SELECT set_config('request.jwt.claims', json_build_object('sub', :'bob', 'role', 'authenticated')::text, true);
UPDATE public.messages SET is_read = true WHERE match_id = :'match_id';
SELECT tests.throws(format('UPDATE public.messages SET content = %L WHERE match_id = %L', 'edited', :'match_id'),
                    'permission denied', 'recipient cannot edit content');
SELECT set_config('request.jwt.claims', json_build_object('sub', :'alice', 'role', 'authenticated')::text, true);
SELECT tests.throws(format('UPDATE public.messages SET content = %L WHERE match_id = %L', 'edited', :'match_id'),
                    'permission denied', 'sender cannot edit content');
-- The sender's own update of is_read matches no rows (only the recipient may mark read).
UPDATE public.messages SET is_read = false WHERE match_id = :'match_id';
RESET ROLE;
SELECT tests.ok((SELECT bool_and(is_read) FROM public.messages WHERE match_id = :'match_id'), 'read receipt persisted; sender cannot unset it');

-- Blocking ends the conversation in both directions.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'bob', 'role', 'authenticated')::text, true);
INSERT INTO public.blocked_users (user_id, blocked_user_id) VALUES (:'bob', :'alice');
SELECT tests.throws(format('INSERT INTO public.messages (match_id, sender_id, content) VALUES (%L, %L, %L)', :'match_id', :'bob', 'x'),
                    'row-level security', 'blocker cannot message');
SELECT set_config('request.jwt.claims', json_build_object('sub', :'alice', 'role', 'authenticated')::text, true);
SELECT tests.throws(format('INSERT INTO public.messages (match_id, sender_id, content) VALUES (%L, %L, %L)', :'match_id', :'alice', 'x'),
                    'row-level security', 'blocked user cannot message');
RESET ROLE;
SELECT tests.ok((SELECT status FROM public.matches WHERE id = :'match_id') = 'blocked', 'blocking marks the match blocked');

-- A blocked pair cannot re-match by swiping again.
DELETE FROM public.matches WHERE id = :'match_id';
DELETE FROM public.swipes;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'alice', 'role', 'authenticated')::text, true);
INSERT INTO public.swipes (user_id, swiped_user_id, direction) VALUES (:'alice', :'bob', 'right');
SELECT set_config('request.jwt.claims', json_build_object('sub', :'bob', 'role', 'authenticated')::text, true);
INSERT INTO public.swipes (user_id, swiped_user_id, direction) VALUES (:'bob', :'alice', 'right');
RESET ROLE;
SELECT tests.ok(NOT EXISTS (SELECT 1 FROM public.matches WHERE user_id IN (:'alice', :'bob') AND matched_user_id IN (:'alice', :'bob')),
                'no match between blocked users');

-- The blocked user can see that they are blocked by nobody's list but the blocker's own (privacy of block lists).
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'alice', 'role', 'authenticated')::text, true);
SELECT tests.ok(tests.row_count('SELECT * FROM public.blocked_users') = 0, 'blocked user cannot read the blocker''s list');
RESET ROLE;
