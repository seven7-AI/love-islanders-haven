-- Approximate location for distance filtering (#21). Written by the API at ~1 km precision. Mirrored by Alembic 0005.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_coordinates_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_coordinates_check CHECK (
  (latitude IS NULL AND longitude IS NULL)
  OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
);

-- Other signed-in users can read profiles, so exact coordinates must never be exposed to client roles (the API reads
-- them with its own role and returns only rounded distances). A column-level REVOKE has no effect while a table-level
-- grant exists, so replace the table grants with column grants on every other column.
-- NOTE: columns added to profiles later must be granted explicitly in their migration.
REVOKE SELECT, INSERT, UPDATE ON public.profiles FROM anon, authenticated;
DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'profiles'
    AND column_name NOT IN ('latitude', 'longitude', 'location_updated_at');
  EXECUTE format('GRANT SELECT (%s), INSERT (%s), UPDATE (%s) ON public.profiles TO authenticated', cols, cols, cols);
END
$$;
