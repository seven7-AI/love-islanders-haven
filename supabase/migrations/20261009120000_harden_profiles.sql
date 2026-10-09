-- Harden profile creation, profile/image read access and server-managed profile columns (#5).

-- 1. Profiles and onboarding rows are created by the database when an auth user is created,
--    replacing the client-side inserts and the service-role create-user-profile edge function.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email_verified)
  VALUES (
    NEW.id,
    coalesce(nullif(NEW.raw_user_meta_data ->> 'name', ''), split_part(NEW.email, '@', 1)),
    NEW.email_confirmed_at IS NOT NULL
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profile_onboarding (profile_id)
  VALUES (NEW.id)
  ON CONFLICT (profile_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. profiles.email_verified mirrors the auth provider's confirmation state.
CREATE OR REPLACE FUNCTION public.handle_user_email_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET email_verified = NEW.email_confirmed_at IS NOT NULL
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmation ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmation
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at)
EXECUTE FUNCTION public.handle_user_email_confirmation();

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_user_email_confirmation() FROM PUBLIC, anon, authenticated;

-- Backfill: profiles for auth users that never got one, and email_verified from the auth provider.
WITH missing AS (
  INSERT INTO public.profiles (id, name)
  SELECT u.id, coalesce(nullif(u.raw_user_meta_data ->> 'name', ''), split_part(u.email, '@', 1))
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE p.id IS NULL
  RETURNING id
)
INSERT INTO public.profile_onboarding (profile_id)
SELECT id FROM missing
ON CONFLICT (profile_id) DO NOTHING;

UPDATE public.profiles p
SET email_verified = u.email_confirmed_at IS NOT NULL
FROM auth.users u
WHERE u.id = p.id
  AND p.email_verified IS DISTINCT FROM (u.email_confirmed_at IS NOT NULL);

-- 3. Email addresses live in auth.users only; the copy in profiles was readable by other users.
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

-- 4. Server-managed columns and age.
--    Clients (anon/authenticated) may not change verified, email_verified or streak_count.
--    age is derived from dob, and dates of birth under 18 are rejected.
CREATE OR REPLACE FUNCTION public.enforce_profile_rules()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  is_client boolean := current_user IN ('anon', 'authenticated');
BEGIN
  IF is_client THEN
    IF TG_OP = 'INSERT' THEN
      IF coalesce(NEW.verified, false) OR coalesce(NEW.email_verified, false) OR coalesce(NEW.streak_count, 0) <> 0 THEN
        RAISE EXCEPTION 'verified, email_verified and streak_count are managed by the server'
          USING ERRCODE = '42501';
      END IF;
    ELSIF NEW.verified IS DISTINCT FROM OLD.verified
       OR NEW.email_verified IS DISTINCT FROM OLD.email_verified
       OR NEW.streak_count IS DISTINCT FROM OLD.streak_count THEN
      RAISE EXCEPTION 'verified, email_verified and streak_count are managed by the server'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.dob IS NOT NULL THEN
    NEW.age := date_part('year', age(current_date, NEW.dob))::integer;
    IF NEW.age < 18 THEN
      RAISE EXCEPTION 'Users must be at least 18 years old' USING ERRCODE = '23514';
    END IF;
  ELSIF is_client THEN
    -- Without a date of birth, clients cannot set an age directly.
    NEW.age := CASE WHEN TG_OP = 'UPDATE' THEN OLD.age END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_enforce_rules ON public.profiles;
CREATE TRIGGER profiles_enforce_rules
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_rules();

-- 5. Streak count is computed when a streak is posted: +1 on consecutive days, unchanged on the
--    same day, back to 1 after a missed day (UTC dates).
CREATE OR REPLACE FUNCTION public.handle_new_streak()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_post_date date;
  current_count integer;
  new_count integer;
BEGIN
  SELECT max((created_at AT TIME ZONE 'UTC')::date) INTO last_post_date
  FROM public.streaks
  WHERE user_id = NEW.user_id;

  SELECT coalesce(streak_count, 0) INTO current_count
  FROM public.profiles
  WHERE id = NEW.user_id
  FOR UPDATE;

  new_count := CASE
    WHEN last_post_date = (now() AT TIME ZONE 'UTC')::date THEN greatest(current_count, 1)
    WHEN last_post_date = (now() AT TIME ZONE 'UTC')::date - 1 THEN current_count + 1
    ELSE 1
  END;

  NEW.streak_count := new_count;
  NEW.likes_count := 0;
  NEW.comments_count := 0;
  NEW.created_at := now();

  UPDATE public.profiles SET streak_count = new_count WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_streak() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS streaks_compute_count ON public.streaks;
CREATE TRIGGER streaks_compute_count
BEFORE INSERT ON public.streaks
FOR EACH ROW EXECUTE FUNCTION public.handle_new_streak();

-- 6. Profiles are readable by signed-in users only.
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Signed-in users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 7. Hidden images are visible only to their owner; anonymous visitors see none.
DROP POLICY IF EXISTS "Users can view visible profile images" ON public.profile_images;
CREATE POLICY "Signed-in users can view visible profile images"
ON public.profile_images
FOR SELECT
TO authenticated
USING (is_visible OR auth.uid() = profile_id);

-- 8. updated_at was maintained by two identical triggers on profiles.
DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
