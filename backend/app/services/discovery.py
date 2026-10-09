"""Discovery feed, swipes and matches."""

import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.pagination import decode_cursor, encode_cursor
from app.schemas.discovery import DiscoverPage, LastMessage, MatchPage, MatchPartner, MatchSummary, SwipeResult
from app.schemas.profile import PublicProfile
from app.services.notifications import notify_match
from app.services.profiles import NotFound

LIKES = ("right", "super")

# Candidates for :me — onboarded, not already swiped/matched/blocked (either way), and compatible under BOTH users'
# saved preferences (gender and age range), plus "verified only" if :me asked for it.
_FEED_SQL = """
WITH me AS (SELECT * FROM profiles WHERE id = :me),
candidates AS (
  SELECT p.*, coalesce(date_part('year', age(current_date, p.dob))::int, p.age) AS current_age,
         CASE WHEN p.latitude IS NOT NULL AND me.latitude IS NOT NULL THEN
           6371 * 2 * asin(sqrt(power(sin(radians(p.latitude - me.latitude) / 2), 2)
             + cos(radians(me.latitude)) * cos(radians(p.latitude))
               * power(sin(radians(p.longitude - me.longitude) / 2), 2)))
         END AS distance_km
  FROM profiles p, me
  WHERE p.id <> me.id
)
SELECT p.*
FROM candidates p, me
WHERE p.onboarding_completed
  AND NOT EXISTS (SELECT 1 FROM swipes s WHERE s.user_id = me.id AND s.swiped_user_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM matches m WHERE least(m.user_id, m.matched_user_id) = least(me.id, p.id)
                                            AND greatest(m.user_id, m.matched_user_id) = greatest(me.id, p.id))
  AND NOT EXISTS (SELECT 1 FROM blocked_users b WHERE (b.user_id = me.id AND b.blocked_user_id = p.id)
                                                 OR (b.user_id = p.id AND b.blocked_user_id = me.id))
  AND (me.gender_preference IS NULL OR me.gender_preference IN ('both', 'everyone') OR p.gender = me.gender_preference)
  AND (p.gender_preference IS NULL OR p.gender_preference IN ('both', 'everyone') OR me.gender IS NULL
       OR p.gender_preference = me.gender)
  AND coalesce(date_part('year', age(current_date, p.dob))::int, p.age, 18)
      BETWEEN coalesce(me.age_range_min, 18) AND coalesce(me.age_range_max, 100)
  AND coalesce(date_part('year', age(current_date, me.dob))::int, me.age, 18)
      BETWEEN coalesce(p.age_range_min, 18) AND coalesce(p.age_range_max, 100)
  AND (NOT coalesce(me.show_me_verified_only, false) OR coalesce(p.verified, false))
  -- People who have not shared a location are not excluded by distance.
  AND (p.distance_km IS NULL OR me.distance_preference IS NULL OR p.distance_km <= me.distance_preference)
  AND (CAST(:after_ts AS timestamptz) IS NULL
       OR (p.created_at, p.id) < (CAST(:after_ts AS timestamptz), CAST(:after_id AS uuid)))
ORDER BY p.created_at DESC, p.id DESC
LIMIT :limit
"""


async def _visible_images(session: AsyncSession, ids: list[uuid.UUID]) -> dict[uuid.UUID, list[str]]:
    if not ids:
        return {}
    rows = await session.execute(
        text(
            "SELECT profile_id, url FROM profile_images WHERE profile_id = ANY(:ids) AND is_visible IS NOT FALSE "
            "ORDER BY profile_id, position, created_at"
        ),
        {"ids": ids},
    )
    images: dict[uuid.UUID, list[str]] = {}
    for profile_id, url in rows:
        images.setdefault(profile_id, []).append(url)
    return images


def _public(row: Any, images: list[str]) -> PublicProfile:
    return PublicProfile(
        id=row.id,
        name=row.display_name or row.name,
        bio=row.bio,
        age=row.current_age if row.show_age is not False else None,
        gender=row.gender,
        relationship_goal=row.relationship_goal,
        height_cm=row.height_cm,
        occupation=row.occupation,
        education=row.education,
        city=row.city,
        country=row.country,
        pronouns=row.pronouns,
        interests=row.interests or [],
        verified=bool(row.verified),
        images=images,
        distance_km=max(1, round(row.distance_km)) if row.distance_km is not None else None,
    )


async def discover(session: AsyncSession, me: uuid.UUID, limit: int, cursor: str | None) -> DiscoverPage:
    after_ts, after_id = decode_cursor(cursor) if cursor else (None, None)
    rows = (
        await session.execute(
            text(_FEED_SQL), {"me": me, "limit": limit + 1, "after_ts": after_ts, "after_id": after_id}
        )
    ).all()
    page, more = rows[:limit], len(rows) > limit
    images = await _visible_images(session, [r.id for r in page])
    return DiscoverPage(
        profiles=[_public(r, images.get(r.id, [])) for r in page],
        next_cursor=encode_cursor(page[-1].created_at, page[-1].id) if more else None,
    )


async def _blocked(session: AsyncSession, a: uuid.UUID, b: uuid.UUID) -> bool:
    return bool(
        await session.scalar(
            text(
                "SELECT EXISTS (SELECT 1 FROM blocked_users WHERE (user_id = :a AND blocked_user_id = :b) "
                "OR (user_id = :b AND blocked_user_id = :a))"
            ),
            {"a": a, "b": b},
        )
    )


async def swipe(session: AsyncSession, me: uuid.UUID, target: uuid.UUID, direction: str) -> SwipeResult:
    if target == me:
        raise AppError(422, "You cannot swipe on yourself", code="invalid_target")
    onboarded = await session.scalar(text("SELECT onboarding_completed FROM profiles WHERE id = :id"), {"id": target})
    if not onboarded or await _blocked(session, me, target):
        raise NotFound("Profile")

    # Both users' swipes on each other are serialised, so simultaneous likes always produce exactly one match.
    lo, hi = sorted((me, target))
    await session.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:k, 0))"), {"k": f"pair:{lo}:{hi}"})

    inserted = await session.scalar(
        text(
            "INSERT INTO swipes (user_id, swiped_user_id, direction) VALUES (:me, :t, :d) "
            "ON CONFLICT (user_id, swiped_user_id) DO NOTHING RETURNING id"
        ),
        {"me": me, "t": target, "d": direction},
    )
    if inserted is None:
        await session.rollback()
        raise AppError(409, "You have already swiped on this profile", code="already_swiped")

    match_id: uuid.UUID | None = None
    if direction in LIKES:
        liked_back = await session.scalar(
            text(
                "SELECT EXISTS (SELECT 1 FROM swipes WHERE user_id = :t AND swiped_user_id = :me "
                "AND direction IN ('right', 'super'))"
            ),
            {"me": me, "t": target},
        )
        if liked_back:
            created = await session.scalar(
                text(
                    "INSERT INTO matches (user_id, matched_user_id, status) VALUES (:me, :t, 'active') "
                    "ON CONFLICT ((least(user_id, matched_user_id)), (greatest(user_id, matched_user_id))) DO NOTHING "
                    "RETURNING id"
                ),
                {"me": me, "t": target},
            )
            match_id = await session.scalar(
                text(
                    "SELECT id FROM matches WHERE least(user_id, matched_user_id) = :lo "
                    "AND greatest(user_id, matched_user_id) = :hi AND status = 'active'"
                ),
                {"lo": lo, "hi": hi},
            )
            # On Supabase Postgres the swipe trigger may have created the match already; notify either way once.
            if match_id is not None and (created is not None or not await _has_match_notifications(session, match_id)):
                await notify_match(session, match_id, me, target)
    await session.commit()
    return SwipeResult(matched=match_id is not None, match_id=match_id)


_MATCHES_SQL = """
SELECT m.id, m.created_at, p.id AS partner_id, coalesce(p.display_name, p.name) AS partner_name,
       CASE WHEN p.show_age IS NOT FALSE
            THEN coalesce(date_part('year', age(current_date, p.dob))::int, p.age) END AS partner_age,
       coalesce(p.avatar_url, (SELECT url FROM profile_images i WHERE i.profile_id = p.id AND i.is_visible IS NOT FALSE
                               ORDER BY i.position LIMIT 1)) AS photo_url,
       last.content AS last_content, last.sender_id AS last_sender, last.created_at AS last_at,
       (SELECT count(*) FROM messages u WHERE u.match_id = m.id AND u.sender_id <> :me AND u.is_read IS NOT TRUE)
         AS unread_count
FROM matches m
JOIN profiles p ON p.id = CASE WHEN m.user_id = :me THEN m.matched_user_id ELSE m.user_id END
LEFT JOIN LATERAL (SELECT content, sender_id, created_at FROM messages x WHERE x.match_id = m.id
                   ORDER BY x.created_at DESC LIMIT 1) last ON true
WHERE :me IN (m.user_id, m.matched_user_id)
  AND m.status = 'active'
  AND (CAST(:after_ts AS timestamptz) IS NULL
       OR (m.created_at, m.id) < (CAST(:after_ts AS timestamptz), CAST(:after_id AS uuid)))
ORDER BY m.created_at DESC, m.id DESC
LIMIT :limit
"""


async def list_matches(session: AsyncSession, me: uuid.UUID, limit: int, cursor: str | None) -> MatchPage:
    after_ts, after_id = decode_cursor(cursor) if cursor else (None, None)
    rows = (
        await session.execute(
            text(_MATCHES_SQL), {"me": me, "limit": limit + 1, "after_ts": after_ts, "after_id": after_id}
        )
    ).all()
    page, more = rows[:limit], len(rows) > limit
    return MatchPage(
        matches=[
            MatchSummary(
                id=r.id,
                created_at=r.created_at,
                partner=MatchPartner(id=r.partner_id, name=r.partner_name, age=r.partner_age, photo_url=r.photo_url),
                last_message=LastMessage(content=r.last_content, sender_id=r.last_sender, created_at=r.last_at)
                if r.last_at is not None
                else None,
                unread_count=r.unread_count,
            )
            for r in page
        ],
        next_cursor=encode_cursor(page[-1].created_at, page[-1].id) if more else None,
    )


async def unmatch(session: AsyncSession, me: uuid.UUID, match_id: uuid.UUID) -> None:
    updated = await session.scalar(
        text(
            "UPDATE matches SET status = 'unmatched' WHERE id = :id AND :me IN (user_id, matched_user_id) "
            "AND status = 'active' RETURNING id"
        ),
        {"id": match_id, "me": me},
    )
    if updated is None:
        raise NotFound("Match")
    await session.commit()


async def _has_match_notifications(session: AsyncSession, match_id: uuid.UUID) -> bool:
    return bool(
        await session.scalar(
            text("SELECT EXISTS (SELECT 1 FROM notifications WHERE match_id = :m AND type = 'match')"), {"m": match_id}
        )
    )
