#!/usr/bin/env bash
# Two users like each other in overlapping transactions: exactly one match must be created.
# Run by ../run.sh after the SQL tests (uses the same PG* environment). Leaves no data behind.
set -euo pipefail
q() { psql -v ON_ERROR_STOP=1 -qAtX "$@"; }

a="$(q -c "SELECT tests.create_user('concurrent-a@example.com')")"
b="$(q -c "SELECT tests.create_user('concurrent-b@example.com')")"

swipe() { # swiper target
  q <<SQL
BEGIN;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '$1', 'role', 'authenticated')::text, true);
INSERT INTO public.swipes (user_id, swiped_user_id, direction) VALUES ('$1', '$2', 'right');
SELECT pg_sleep(1);
COMMIT;
SQL
}

swipe "$a" "$b" >/dev/null & p1=$!
swipe "$b" "$a" >/dev/null & p2=$!
wait "$p1" "$p2"

n="$(q -c "SELECT count(*) FROM public.matches WHERE least(user_id, matched_user_id) = least('$a'::uuid, '$b'::uuid) AND greatest(user_id, matched_user_id) = greatest('$a'::uuid, '$b'::uuid)")"
q -c "DELETE FROM auth.users WHERE id IN ('$a', '$b')" >/dev/null
q -c "DELETE FROM public.profiles WHERE id IN ('$a', '$b')" >/dev/null

if [[ "$n" != "1" ]]; then
  echo "expected 1 match for simultaneous mutual likes, got $n"
  exit 1
fi
