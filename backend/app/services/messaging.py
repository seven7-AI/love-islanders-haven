"""Conversations between matched users."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.pagination import decode_cursor, encode_cursor
from app.integrations.storage import SignedUpload, StorageError, StorageProvider
from app.schemas.messages import MessageCreate, MessageOut, MessagePage
from app.services.notifications import notify_message
from app.services.profiles import NotFound
from app.services.uploads import MAX_MEDIA_BYTES, MEDIA_EXTENSIONS, storage_unavailable, verify_upload

MEDIA_URL_TTL_SECONDS = 3600


async def _require_active_member(session: AsyncSession, me: uuid.UUID, match_id: uuid.UUID) -> None:
    """The match exists, the user is in it, it is active, and neither side has blocked the other."""
    ok = await session.scalar(
        text(
            "SELECT EXISTS (SELECT 1 FROM matches m WHERE m.id = :id AND :me IN (m.user_id, m.matched_user_id) "
            "AND m.status = 'active' AND NOT EXISTS (SELECT 1 FROM blocked_users b WHERE "
            "(b.user_id = m.user_id AND b.blocked_user_id = m.matched_user_id) OR "
            "(b.user_id = m.matched_user_id AND b.blocked_user_id = m.user_id)))"
        ),
        {"id": match_id, "me": me},
    )
    if not ok:
        raise NotFound("Conversation")


async def _to_out(row: Any, storage: StorageProvider, bucket: str) -> MessageOut:
    media_url = None
    if row.media_url:
        try:
            media_url = await storage.signed_download_url(bucket, row.media_url, MEDIA_URL_TTL_SECONDS)
        except StorageError:
            media_url = None  # message text still shows; the client renders the media as unavailable
    return MessageOut(
        id=row.id,
        match_id=row.match_id,
        sender_id=row.sender_id,
        content=row.content,
        content_type=row.content_type or "text",
        media_url=media_url,
        is_read=bool(row.is_read),
        created_at=row.created_at,
    )


async def list_messages(
    session: AsyncSession,
    storage: StorageProvider,
    bucket: str,
    me: uuid.UUID,
    match_id: uuid.UUID,
    *,
    limit: int,
    before: str | None,
    after: datetime | None,
) -> MessagePage:
    await _require_active_member(session, me, match_id)
    if after is not None:
        # Polling for new messages: everything after the given time, oldest first.
        rows = (
            await session.execute(
                text(
                    "SELECT id, match_id, sender_id, content, content_type, media_url, is_read, created_at "
                    "FROM messages WHERE match_id = :m AND created_at > :after "
                    "ORDER BY created_at, id LIMIT :limit"
                ),
                {"m": match_id, "after": after, "limit": limit},
            )
        ).all()
        return MessagePage(messages=[await _to_out(r, storage, bucket) for r in rows], older_cursor=None)

    before_ts, before_id = decode_cursor(before) if before else (None, None)
    rows = (
        await session.execute(
            text(
                "SELECT id, match_id, sender_id, content, content_type, media_url, is_read, created_at "
                "FROM messages WHERE match_id = :m AND (CAST(:ts AS timestamptz) IS NULL "
                "OR (created_at, id) < (CAST(:ts AS timestamptz), CAST(:bid AS uuid))) "
                "ORDER BY created_at DESC, id DESC LIMIT :limit"
            ),
            {"m": match_id, "ts": before_ts, "bid": before_id, "limit": limit + 1},
        )
    ).all()
    page, more = list(reversed(rows[:limit])), len(rows) > limit
    return MessagePage(
        messages=[await _to_out(r, storage, bucket) for r in page],
        older_cursor=encode_cursor(page[0].created_at, page[0].id) if more and page else None,
    )


async def create_media_upload(
    session: AsyncSession, storage: StorageProvider, bucket: str, me: uuid.UUID, match_id: uuid.UUID, content_type: str
) -> SignedUpload:
    await _require_active_member(session, me, match_id)
    path = f"{match_id}/{me}/{uuid.uuid4()}.{MEDIA_EXTENSIONS[content_type]}"
    try:
        return await storage.create_signed_upload(bucket, path)
    except StorageError as exc:
        raise storage_unavailable(exc) from exc


async def send_message(
    session: AsyncSession,
    storage: StorageProvider,
    bucket: str,
    me: uuid.UUID,
    match_id: uuid.UUID,
    body: MessageCreate,
) -> MessageOut:
    await _require_active_member(session, me, match_id)
    if body.media_path is not None:
        if not body.media_path.startswith(f"{match_id}/{me}/") or ".." in body.media_path:
            raise AppError(403, "You can only send media you uploaded to this conversation", code="forbidden_path")
        await verify_upload(storage, bucket, body.media_path, allowed=MEDIA_EXTENSIONS, max_bytes=MAX_MEDIA_BYTES)
    row = (
        await session.execute(
            text(
                "INSERT INTO messages (match_id, sender_id, content, content_type, media_url) "
                "VALUES (:m, :me, :c, :t, :media) "
                "RETURNING id, match_id, sender_id, content, content_type, media_url, is_read, created_at"
            ),
            {"m": match_id, "me": me, "c": body.content.strip(), "t": body.content_type, "media": body.media_path},
        )
    ).one()
    recipient = await session.scalar(
        text("SELECT CASE WHEN user_id = :me THEN matched_user_id ELSE user_id END FROM matches WHERE id = :m"),
        {"me": me, "m": match_id},
    )
    await notify_message(session, match_id, me, recipient)
    await session.commit()
    return await _to_out(row, storage, bucket)


async def mark_read(session: AsyncSession, me: uuid.UUID, match_id: uuid.UUID) -> int:
    await _require_active_member(session, me, match_id)
    result = await session.execute(
        text(
            "UPDATE messages SET is_read = true WHERE match_id = :m AND sender_id <> :me AND is_read IS NOT TRUE "
            "RETURNING id"
        ),
        {"m": match_id, "me": me},
    )
    count = len(result.all())
    await session.commit()
    return count
