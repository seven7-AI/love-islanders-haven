"""In-app notifications. Created inside the transaction of the action that causes them."""

import uuid

from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.pagination import decode_cursor, encode_cursor
from app.db.models import Notification
from app.schemas.notifications import NotificationOut, NotificationPage


async def notify_match(session: AsyncSession, match_id: uuid.UUID, a: uuid.UUID, b: uuid.UUID) -> None:
    session.add_all(
        [
            Notification(user_id=a, type="match", actor_id=b, match_id=match_id),
            Notification(user_id=b, type="match", actor_id=a, match_id=match_id),
        ]
    )
    await session.flush()


async def notify_message(session: AsyncSession, match_id: uuid.UUID, sender: uuid.UUID, recipient: uuid.UUID) -> None:
    """One unread notification per conversation: later messages refresh it instead of piling up."""
    refreshed = await session.execute(
        update(Notification)
        .where(
            Notification.user_id == recipient,
            Notification.match_id == match_id,
            Notification.type == "message",
            Notification.is_read.is_(False),
        )
        .values(created_at=func.now(), actor_id=sender)
        .returning(Notification.id)
    )
    if refreshed.first() is None:
        session.add(Notification(user_id=recipient, type="message", actor_id=sender, match_id=match_id))
    await session.flush()


async def notify_streak_like(session: AsyncSession, streak_id: uuid.UUID, liker: uuid.UUID) -> None:
    author = await session.scalar(text("SELECT user_id FROM streaks WHERE id = :id"), {"id": streak_id})
    if author is None or author == liker:
        return
    exists = await session.scalar(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == author, Notification.streak_id == streak_id, Notification.actor_id == liker)
    )
    if not exists:  # unlike + like again does not notify twice
        session.add(Notification(user_id=author, type="streak_like", actor_id=liker, streak_id=streak_id))
        await session.flush()


_LIST_SQL = """
SELECT n.id, n.type, n.actor_id, coalesce(p.display_name, p.name) AS actor_name, p.avatar_url AS actor_photo_url,
       n.match_id, n.streak_id, n.is_read, n.created_at
FROM notifications n
LEFT JOIN profiles p ON p.id = n.actor_id
WHERE n.user_id = :me
  AND NOT EXISTS (SELECT 1 FROM blocked_users b WHERE (b.user_id = :me AND b.blocked_user_id = n.actor_id)
                                                 OR (b.user_id = n.actor_id AND b.blocked_user_id = :me))
  AND (CAST(:after_ts AS timestamptz) IS NULL
       OR (n.created_at, n.id) < (CAST(:after_ts AS timestamptz), CAST(:after_id AS uuid)))
ORDER BY n.created_at DESC, n.id DESC
LIMIT :limit
"""


async def list_notifications(session: AsyncSession, me: uuid.UUID, limit: int, cursor: str | None) -> NotificationPage:
    after_ts, after_id = decode_cursor(cursor) if cursor else (None, None)
    rows = (
        await session.execute(
            text(_LIST_SQL), {"me": me, "limit": limit + 1, "after_ts": after_ts, "after_id": after_id}
        )
    ).all()
    page, more = rows[:limit], len(rows) > limit
    unread = await session.scalar(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == me, Notification.is_read.is_(False))
    )
    return NotificationPage(
        notifications=[NotificationOut.model_validate(r._mapping) for r in page],
        unread_count=unread or 0,
        next_cursor=encode_cursor(page[-1].created_at, page[-1].id) if more else None,
    )


async def mark_read(session: AsyncSession, me: uuid.UUID, ids: list[uuid.UUID] | None, everything: bool) -> int:
    query = update(Notification).where(Notification.user_id == me, Notification.is_read.is_(False))
    if not everything:
        query = query.where(Notification.id.in_(ids or []))
    result = await session.execute(query.values(is_read=True).returning(Notification.id))
    count = len(result.all())
    await session.commit()
    return count
