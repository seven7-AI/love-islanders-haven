-- Test helpers, loaded after the migrations. Tests run as the roles PostgREST would use.
CREATE SCHEMA tests;
GRANT USAGE ON SCHEMA tests TO anon, authenticated, service_role;

-- Create an auth user (fires the same triggers as a real sign-up) and return its id.
CREATE FUNCTION tests.create_user(_email text, _name text DEFAULT NULL, _confirmed boolean DEFAULT true)
RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO auth.users (email, raw_user_meta_data, email_confirmed_at)
  VALUES (_email,
          CASE WHEN _name IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('name', _name) END,
          CASE WHEN _confirmed THEN now() END)
  RETURNING id
$$;

-- Fail the test with a message unless the condition holds.
CREATE FUNCTION tests.ok(_cond boolean, _msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF _cond IS NOT TRUE THEN
    RAISE EXCEPTION 'FAILED: %', _msg;
  END IF;
END
$$;

-- Assert that executing _sql (as the current role) raises an error whose message contains _expected.
CREATE FUNCTION tests.throws(_sql text, _expected text, _msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE _sql;
  EXCEPTION WHEN OTHERS THEN
    IF position(_expected IN SQLERRM) = 0 THEN
      RAISE EXCEPTION 'FAILED: % (expected error containing "%", got "%")', _msg, _expected, SQLERRM;
    END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'FAILED: % (statement succeeded: %)', _msg, _sql;
END
$$;

-- Number of rows _sql returns for the current role (RLS applied).
CREATE FUNCTION tests.row_count(_sql text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE _n bigint;
BEGIN
  EXECUTE format('SELECT count(*) FROM (%s) q', _sql) INTO _n;
  RETURN _n;
END
$$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tests TO anon, authenticated, service_role;
