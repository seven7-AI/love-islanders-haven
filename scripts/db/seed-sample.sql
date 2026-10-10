-- Small data set for the backup/restore and data-copy drills, consistent with the app's rules (onboarded users have
-- 4 photos and the 'completed' step). Safe to load into an empty schema. Local accounts: backend/seed (docs/development/seed-data.md).
INSERT INTO public.profiles (id, name, dob, gender, gender_preference, onboarding_completed) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Ava', '1995-04-02', 'female', 'male', true),
  ('22222222-2222-2222-2222-222222222222', 'Ben', '1993-09-17', 'male', 'female', true),
  ('33333333-3333-3333-3333-333333333333', 'Cleo', '1998-12-30', 'female', 'both', true);
INSERT INTO public.profile_onboarding (profile_id, completed, current_step) VALUES
  ('11111111-1111-1111-1111-111111111111', true, 'completed'),
  ('22222222-2222-2222-2222-222222222222', true, 'completed'),
  ('33333333-3333-3333-3333-333333333333', true, 'completed');
INSERT INTO public.profile_images (profile_id, url, position)
SELECT p.id::uuid, 'https://example.com/' || p.name || '-' || n || '.jpg', n
FROM (VALUES ('11111111-1111-1111-1111-111111111111', 'ava'), ('22222222-2222-2222-2222-222222222222', 'ben'),
             ('33333333-3333-3333-3333-333333333333', 'cleo')) AS p(id, name),
     generate_series(0, 3) AS n;
INSERT INTO public.swipes (user_id, swiped_user_id, direction) VALUES
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'right'),
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'right'),
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'left');
INSERT INTO public.matches (id, user_id, matched_user_id, status) VALUES
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'active');
INSERT INTO public.messages (match_id, sender_id, content) VALUES
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Hi Ben!'),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'Hey Ava');
INSERT INTO public.user_settings (user_id) VALUES ('11111111-1111-1111-1111-111111111111');
INSERT INTO public.safety_contacts (id, user_id, contact_name, contact_phone) VALUES
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'Mum', '+254700000000');
INSERT INTO public.date_plans (user_id, title, contact_id) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Coffee with Ben', '55555555-5555-5555-5555-555555555555');
INSERT INTO public.streaks (id, user_id, content) VALUES
  ('66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333', '["https://example.com/cleo-streak.jpg"]');
INSERT INTO public.streak_likes (user_id, streak_id) VALUES
  ('11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666');
INSERT INTO public.blocked_users (user_id, blocked_user_id) VALUES
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111');
INSERT INTO public.ai_chat_history (user_id, role, message_content) VALUES
  ('22222222-2222-2222-2222-222222222222', 'user', 'Date ideas?');
INSERT INTO public.user_feedback (user_id, feedback_type, feedback_content) VALUES
  ('22222222-2222-2222-2222-222222222222', 'bug', 'Sample feedback');
