-- Matches only come from mutual likes; messaging requires an active, unblocked match; read receipts work (#7).

-- 1. Block lookups that ignore RLS on blocked_users (each user can only read their own block list).
CREATE OR REPLACE FUNCTION public.is_blocked_pair(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE (user_id = a AND blocked_user_id = b)
       OR (user_id = b AND blocked_user_id = a)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_blocked_pair(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_blocked_pair(uuid, uuid) TO authenticated, service_role;

-- 2. One match per pair of users regardless of direction. Merge existing (A,B)/(B,A) duplicates first,
--    keeping the oldest match and moving its duplicates' messages onto it.
CREATE TEMP TABLE duplicate_matches AS
SELECT id, keep_id
FROM (
  SELECT id,
         first_value(id) OVER w AS keep_id,
         row_number() OVER w AS rn
  FROM public.matches
  WINDOW w AS (PARTITION BY least(user_id, matched_user_id), greatest(user_id, matched_user_id)
               ORDER BY created_at, id)
) ranked
WHERE rn > 1;

UPDATE public.messages msg
SET match_id = d.keep_id
FROM duplicate_matches d
WHERE msg.match_id = d.id;

DELETE FROM public.matches m
USING duplicate_matches d
WHERE m.id = d.id;

DROP TABLE duplicate_matches;

CREATE UNIQUE INDEX IF NOT EXISTS matches_pair_unique
ON public.matches (least(user_id, matched_user_id), greatest(user_id, matched_user_id));

-- 3. Clients can read their matches but not create or change them.
DROP POLICY IF EXISTS "Users can create matches" ON public.matches;
DROP POLICY IF EXISTS "Users can update their matches" ON public.matches;

-- 4. Mutual like → match. The advisory lock serialises the two users' swipes so simultaneous likes
--    cannot both miss each other; blocked pairs never match.
CREATE OR REPLACE FUNCTION public.handle_mutual_swipe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.direction NOT IN ('right', 'super') THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(least(NEW.user_id, NEW.swiped_user_id)::text || greatest(NEW.user_id, NEW.swiped_user_id)::text, 0)
  );

  IF public.is_blocked_pair(NEW.user_id, NEW.swiped_user_id) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.swipes
    WHERE user_id = NEW.swiped_user_id
      AND swiped_user_id = NEW.user_id
      AND direction IN ('right', 'super')
  ) THEN
    INSERT INTO public.matches (user_id, matched_user_id, status)
    VALUES (NEW.user_id, NEW.swiped_user_id, 'active')
    ON CONFLICT ((least(user_id, matched_user_id)), (greatest(user_id, matched_user_id))) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_mutual_swipe() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.swipes DROP CONSTRAINT IF EXISTS swipes_not_self;
ALTER TABLE public.swipes
  ADD CONSTRAINT swipes_not_self CHECK (user_id <> swiped_user_id) NOT VALID;

-- 5. Blocking someone closes any match with them.
CREATE OR REPLACE FUNCTION public.handle_new_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.matches
  SET status = 'blocked'
  WHERE least(user_id, matched_user_id) = least(NEW.user_id, NEW.blocked_user_id)
    AND greatest(user_id, matched_user_id) = greatest(NEW.user_id, NEW.blocked_user_id);
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_block() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS blocked_users_close_match ON public.blocked_users;
CREATE TRIGGER blocked_users_close_match
AFTER INSERT ON public.blocked_users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_block();

UPDATE public.matches m
SET status = 'blocked'
WHERE m.status IS DISTINCT FROM 'blocked'
  AND public.is_blocked_pair(m.user_id, m.matched_user_id);

-- 6. Sending requires an active match the sender belongs to, with no block either way.
DROP POLICY IF EXISTS "Users can send messages in their matches" ON public.messages;
DROP POLICY IF EXISTS "Members can send messages in active matches" ON public.messages;
CREATE POLICY "Members can send messages in active matches"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_id
      AND m.status = 'active'
      AND auth.uid() IN (m.user_id, m.matched_user_id)
      AND NOT public.is_blocked_pair(m.user_id, m.matched_user_id)
  )
);

-- 7. Read receipts: only the recipient may update a message, and only its is_read column.
REVOKE UPDATE ON public.messages FROM anon, authenticated;
GRANT UPDATE (is_read) ON public.messages TO authenticated;

DROP POLICY IF EXISTS "Recipients can mark messages read" ON public.messages;
CREATE POLICY "Recipients can mark messages read"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  sender_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_id AND auth.uid() IN (m.user_id, m.matched_user_id)
  )
)
WITH CHECK (
  sender_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_id AND auth.uid() IN (m.user_id, m.matched_user_id)
  )
);

-- 8. Indexes for the access paths above; drop indexes duplicated by unique constraints.
CREATE INDEX IF NOT EXISTS messages_match_created_idx ON public.messages (match_id, created_at);
CREATE INDEX IF NOT EXISTS messages_sender_idx ON public.messages (sender_id);
CREATE INDEX IF NOT EXISTS matches_matched_user_idx ON public.matches (matched_user_id);
CREATE INDEX IF NOT EXISTS blocked_users_blocked_idx ON public.blocked_users (blocked_user_id);
CREATE INDEX IF NOT EXISTS ai_chat_history_user_created_idx ON public.ai_chat_history (user_id, created_at);
CREATE INDEX IF NOT EXISTS streaks_user_created_idx ON public.streaks (user_id, created_at);
CREATE INDEX IF NOT EXISTS streak_likes_streak_idx ON public.streak_likes (streak_id);
CREATE INDEX IF NOT EXISTS date_plans_user_idx ON public.date_plans (user_id);
CREATE INDEX IF NOT EXISTS safety_contacts_user_idx ON public.safety_contacts (user_id);
CREATE INDEX IF NOT EXISTS user_feedback_user_idx ON public.user_feedback (user_id);
DROP INDEX IF EXISTS public.matches_user_idx;
DROP INDEX IF EXISTS public.swipes_user_idx;

-- 9. updated_at maintenance on the remaining tables that have the column.
DROP TRIGGER IF EXISTS update_date_plans_updated_at ON public.date_plans;
CREATE TRIGGER update_date_plans_updated_at
BEFORE UPDATE ON public.date_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
