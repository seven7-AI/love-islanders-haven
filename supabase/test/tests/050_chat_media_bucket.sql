-- Chat media is private and not directly accessible to clients (#15).
SELECT tests.create_user('alice@example.com', 'Alice') AS alice \gset

SELECT tests.ok((SELECT public FROM storage.buckets WHERE id = 'chat-media') = false, 'chat-media bucket is private');
INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('chat-media', 'm1/u1/a.jpg', :'alice');

SET ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'alice', 'role', 'authenticated')::text, true);
SELECT tests.ok(tests.row_count($$SELECT * FROM storage.objects WHERE bucket_id = 'chat-media'$$) = 0,
                'signed-in users cannot read chat media objects directly');
SELECT tests.throws($$INSERT INTO storage.objects (bucket_id, name) VALUES ('chat-media', 'x/y/z.jpg')$$,
                    'row-level security', 'signed-in users cannot write chat media directly');
RESET ROLE;
