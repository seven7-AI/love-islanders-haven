#!/usr/bin/env bash
# Compare two databases after a restore or data copy: exact row counts per public table must match, and the
# target must have no rows violating the app's integrity rules.
# Usage: scripts/db/validate.sh <source-postgres-url> <target-postgres-url>
set -euo pipefail
src="${1:?usage: validate.sh <source-url> <target-url>}"
dst="${2:?usage: validate.sh <source-url> <target-url>}"

TABLES="profiles profile_onboarding profile_images ai_chat_history user_feedback blocked_users safety_contacts
date_plans matches messages swipes user_settings streaks streak_likes"

count() { psql "$1" -qAtX -c "select count(*) from public.$2"; }

status=0
printf '%-20s %10s %10s\n' table source target
for t in $TABLES; do
  a="$(count "$src" "$t")"; b="$(count "$dst" "$t")"
  flag=""; [[ "$a" == "$b" ]] || { flag="  MISMATCH"; status=1; }
  printf '%-20s %10s %10s%s\n' "$t" "$a" "$b" "$flag"
done

# Integrity rules that are not all expressible as FKs.
checks="
select 'matches duplicated in reverse', count(*) from (select 1 from public.matches
  group by least(user_id, matched_user_id), greatest(user_id, matched_user_id) having count(*) > 1) d
union all select 'messages without a match', count(*) from public.messages m
  where not exists (select 1 from public.matches x where x.id = m.match_id)
union all select 'profiles under 18', count(*) from public.profiles where dob > current_date - interval '18 years'
"
while IFS='|' read -r name n; do
  [[ -z "$name" ]] && continue
  flag=""; [[ "$n" == "0" ]] || { flag="  FAIL"; status=1; }
  printf 'check: %-32s %s%s\n' "$name" "$n" "$flag"
done < <(psql "$dst" -qAtX -c "$checks")

if [[ "$status" == 0 ]]; then echo "OK"; else echo "VALIDATION FAILED"; fi
exit "$status"
