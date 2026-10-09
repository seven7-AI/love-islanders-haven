"""Daily photo streaks: posting, likes, status and leaderboard.

A user's streak counts consecutive UTC days with at least one post. The stored profiles.streak_count is updated when
they post; reads use the *effective* streak, which is 0 once a whole day has passed without a post.
"""

import json
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.pagination import decode_cursor, encode_cursor
from app.integrations.storage import SignedUpload, StorageError, StorageProvider
from app.schemas.streaks import LeaderboardEntry, LikeState, StreakCreate, StreakFeed, StreakPost, StreakStatus
from app.services.profiles import EXTENSIONS, NotFound, _storage_unavailable

# Effective streak (in both queries below): the stored count while the latest post is from today or yesterday (UTC),
# otherwise 0.
_STATUS_SQL = """
SELECT CASE WHEN (SELECT max((s.created_at AT TIME ZONE 'UTC')::date) FROM streaks s WHERE s.user_id = p.id)
                 >= (now() AT TIME ZONE 'UTC')::date - 1
            THEN coalesce(p.streak_count, 0) ELSE 0 END AS streak,
       EXISTS (SELECT 1 FROM streaks s WHERE s.user_id = p.id
               AND (s.created_at AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date) AS posted
FROM profiles p
WHERE p.id = :me
"""

_LEADERBOARD_SQL = """
SELECT * FROM (
  SELECT p.id, coalesce(p.display_name, p.name) AS name,
         CASE WHEN (SELECT max((s.created_at AT TIME ZONE 'UTC')::date) FROM streaks s WHERE s.user_id = p.id)
                   >= (now() AT TIME ZONE 'UTC')::date - 1
              THEN coalesce(p.streak_count, 0) ELSE 0 END AS streak
  FROM profiles p
  WHERE coalesce(p.streak_count, 0) > 0
    AND NOT EXISTS (SELECT 1 FROM blocked_users b WHERE (b.user_id = :me AND b.blocked_user_id = p.id)
                                                   OR (b.user_id = p.id AND b.blocked_user_id = :me))
) ranked
WHERE streak > 0
ORDER BY streak DESC, id
LIMIT :limit
"""

_INSERT_SQL = """
INSERT INTO streaks (user_id, content, caption, streak_count, likes_count, comments_count, expires_at)
VALUES (:me, :content, :caption, :count, 0, 0, now() + make_interval(hours => :hours))
RETURNING id, created_at, expires_at, streak_count
"""

_VISIBLE_SQL = """
SELECT EXISTS (
  SELECT 1 FROM streaks s
  WHERE s.id = :id AND (s.expires_at IS NULL OR s.expires_at > now())
    AND NOT EXISTS (SELECT 1 FROM blocked_users b WHERE (b.user_id = :me AND b.blocked_user_id = s.user_id)
                                                   OR (b.user_id = s.user_id AND b.blocked_user_id = :me))
)
"""


def _images(content: str) -> list[str]:
    try:
        parsed = json.loads(content)
    except ValueError:
        return [content] if content else []
    return [str(u) for u in parsed if u] if isinstance(parsed, list) else [str(parsed)]


async def create_upload(storage: StorageProvider, bucket: str, me: uuid.UUID, content_type: str) -> SignedUpload:
    path = f"{me}/streaks/{uuid.uuid4()}.{EXTENSIONS[content_type]}"
    try:
        return await storage.create_signed_upload(bucket, path)
    except StorageError as exc:
        raise _storage_unavailable(exc) from exc


async def create_post(
    session: AsyncSession, storage: StorageProvider, bucket: str, me: uuid.UUID, body: StreakCreate
) -> StreakPost:
    urls: list[str] = []
    for path in body.media_paths:
        if not path.startswith(f"{me}/streaks/") or ".." in path:
            raise AppError(403, "You can only post photos you uploaded", code="forbidden_path")
        try:
            if not await storage.exists(bucket, path):
                raise AppError(422, "An uploaded photo was not found; upload it again", code="upload_missing")
            urls.append(storage.public_url(bucket, path))
        except StorageError as exc:
            raise _storage_unavailable(exc) from exc

    # One post at a time per user, so the streak is computed from a consistent "last post".
    await session.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:k, 0))"), {"k": f"streak:{me}"})
    last_day = await session.scalar(
        text("SELECT max((created_at AT TIME ZONE 'UTC')::date) FROM streaks WHERE user_id = :me"), {"me": me}
    )
    current = await session.scalar(text("SELECT coalesce(streak_count, 0) FROM profiles WHERE id = :me"), {"me": me})
    today = datetime.now(UTC).date()
    if last_day == today:
        count = max(current or 0, 1)
    elif last_day == today - timedelta(days=1):
        count = (current or 0) + 1
    else:
        count = 1

    row = (
        await session.execute(
            text(_INSERT_SQL),
            {
                "me": me,
                "content": json.dumps(urls),
                "caption": body.caption,
                "count": count,
                "hours": body.duration_hours,
            },
        )
    ).one()
    # (On Supabase Postgres a trigger computes the same value; read it back rather than assume.)
    await session.execute(
        text("UPDATE profiles SET streak_count = :c WHERE id = :me"), {"c": row.streak_count, "me": me}
    )
    author = (
        await session.execute(
            text("SELECT coalesce(display_name, name) AS name, avatar_url FROM profiles WHERE id = :me"), {"me": me}
        )
    ).one()
    await session.commit()
    return StreakPost(
        id=row.id,
        user_id=me,
        author_name=author.name,
        author_photo_url=author.avatar_url,
        images=urls,
        caption=body.caption,
        streak_count=row.streak_count,
        likes_count=0,
        liked_by_me=False,
        created_at=row.created_at,
        expires_at=row.expires_at,
    )


_FEED_SQL = """
SELECT s.id, s.user_id, s.content, s.caption, coalesce(s.streak_count, 1) AS streak_count,
       coalesce(s.likes_count, 0) AS likes_count, s.created_at, s.expires_at,
       coalesce(p.display_name, p.name) AS author_name, p.avatar_url,
       EXISTS (SELECT 1 FROM streak_likes l WHERE l.streak_id = s.id AND l.user_id = :me) AS liked_by_me
FROM streaks s
JOIN profiles p ON p.id = s.user_id
WHERE (s.expires_at IS NULL OR s.expires_at > now())
  AND NOT EXISTS (SELECT 1 FROM blocked_users b WHERE (b.user_id = :me AND b.blocked_user_id = s.user_id)
                                                 OR (b.user_id = s.user_id AND b.blocked_user_id = :me))
  AND (CAST(:after_ts AS timestamptz) IS NULL
       OR (s.created_at, s.id) < (CAST(:after_ts AS timestamptz), CAST(:after_id AS uuid)))
ORDER BY s.created_at DESC, s.id DESC
LIMIT :limit
"""


def _post(row: Any) -> StreakPost:
    return StreakPost(
        id=row.id,
        user_id=row.user_id,
        author_name=row.author_name,
        author_photo_url=row.avatar_url,
        images=_images(row.content),
        caption=row.caption,
        streak_count=row.streak_count,
        likes_count=row.likes_count,
        liked_by_me=row.liked_by_me,
        created_at=row.created_at,
        expires_at=row.expires_at,
    )


async def feed(session: AsyncSession, me: uuid.UUID, limit: int, cursor: str | None) -> StreakFeed:
    after_ts, after_id = decode_cursor(cursor) if cursor else (None, None)
    rows = (
        await session.execute(
            text(_FEED_SQL), {"me": me, "limit": limit + 1, "after_ts": after_ts, "after_id": after_id}
        )
    ).all()
    page, more = rows[:limit], len(rows) > limit
    return StreakFeed(
        posts=[_post(r) for r in page],
        next_cursor=encode_cursor(page[-1].created_at, page[-1].id) if more else None,
    )


async def _visible_post(session: AsyncSession, me: uuid.UUID, post_id: uuid.UUID) -> None:
    ok = await session.scalar(
        text(_VISIBLE_SQL),
        {"id": post_id, "me": me},
    )
    if not ok:
        raise NotFound("Post")


async def set_like(session: AsyncSession, me: uuid.UUID, post_id: uuid.UUID, liked: bool) -> LikeState:
    """Idempotent like/unlike; the counter changes only when the like row was actually added or removed."""
    await _visible_post(session, me, post_id)
    if liked:
        changed = await session.scalar(
            text(
                "WITH ins AS (INSERT INTO streak_likes (user_id, streak_id) VALUES (:me, :id) "
                "ON CONFLICT (user_id, streak_id) DO NOTHING RETURNING 1) "
                "UPDATE streaks SET likes_count = coalesce(likes_count, 0) + (SELECT count(*) FROM ins) "
                "WHERE id = :id RETURNING likes_count"
            ),
            {"me": me, "id": post_id},
        )
    else:
        changed = await session.scalar(
            text(
                "WITH del AS (DELETE FROM streak_likes WHERE user_id = :me AND streak_id = :id RETURNING 1) "
                "UPDATE streaks SET likes_count = greatest(coalesce(likes_count, 0) - (SELECT count(*) FROM del), 0) "
                "WHERE id = :id RETURNING likes_count"
            ),
            {"me": me, "id": post_id},
        )
    await session.commit()
    return LikeState(liked=liked, likes_count=changed or 0)


async def status(session: AsyncSession, me: uuid.UUID) -> StreakStatus:
    row = (
        await session.execute(
            text(_STATUS_SQL),
            {"me": me},
        )
    ).one()
    return StreakStatus(has_posted_today=row.posted, streak_count=row.streak)


async def leaderboard(session: AsyncSession, me: uuid.UUID, limit: int) -> list[LeaderboardEntry]:
    rows = (
        await session.execute(
            text(_LEADERBOARD_SQL),
            {"me": me, "limit": limit},
        )
    ).all()
    return [LeaderboardEntry(user_id=r.id, name=r.name, streak_count=r.streak) for r in rows]


async def delete_expired(session: AsyncSession, storage: StorageProvider, bucket: str, *, older_than: timedelta) -> int:
    """Removes posts that expired more than `older_than` ago, and their photos. Returns the number of posts removed."""
    rows = (
        await session.execute(
            text("SELECT id, content FROM streaks WHERE expires_at < now() - make_interval(secs => :s)"),
            {"s": older_than.total_seconds()},
        )
    ).all()
    removed = 0
    for row in rows:
        paths = [p for url in _images(row.content) if (p := storage.path_from_public_url(bucket, url))]
        if paths:
            try:
                await storage.delete(bucket, paths)
            except StorageError:
                continue  # keep the post; the next run retries
        await session.execute(text("DELETE FROM streaks WHERE id = :id"), {"id": row.id})
        removed += 1
    await session.commit()
    return removed
