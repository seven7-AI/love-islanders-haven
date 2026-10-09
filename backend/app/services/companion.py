"""AI dating companion ("Isla"). The server stores both sides of the conversation; clients only send their text."""

import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.pagination import decode_cursor, encode_cursor
from app.integrations.llm import ChatTurn, LLMError, LLMNotConfigured, LLMProvider
from app.schemas.companion import CompanionExchange, CompanionHistory, CompanionMessage

CONTEXT_MESSAGES = 20

STYLES = {
    "playful": "playful and light-hearted",
    "caring": "warm and caring",
    "thoughtful": "thoughtful and reflective",
    "flirty": "charming and gently flirtatious (never explicit)",
}


def _message(row: Any) -> CompanionMessage:
    return CompanionMessage(id=row.id, role=row.role, content=row.message_content, created_at=row.created_at)


async def history(session: AsyncSession, me: uuid.UUID, limit: int, before: str | None) -> CompanionHistory:
    ts, row_id = decode_cursor(before) if before else (None, None)
    rows = (
        await session.execute(
            text(
                "SELECT id, role, message_content, created_at FROM ai_chat_history WHERE user_id = :me "
                "AND role IN ('user', 'assistant') AND (CAST(:ts AS timestamptz) IS NULL "
                "OR (created_at, id) < (CAST(:ts AS timestamptz), CAST(:rid AS uuid))) "
                "ORDER BY created_at DESC, id DESC LIMIT :limit"
            ),
            {"me": me, "ts": ts, "rid": row_id, "limit": limit + 1},
        )
    ).all()
    page, more = list(reversed(rows[:limit])), len(rows) > limit
    return CompanionHistory(
        messages=[_message(r) for r in page],
        older_cursor=encode_cursor(page[0].created_at, page[0].id) if more and page else None,
    )


async def _system_prompt(session: AsyncSession, me: uuid.UUID) -> str:
    row = (
        await session.execute(
            text(
                "SELECT coalesce(p.display_name, p.name) AS name, s.preferences -> 'ai_companion_settings' AS ai "
                "FROM profiles p LEFT JOIN user_settings s ON s.user_id = p.id WHERE p.id = :me"
            ),
            {"me": me},
        )
    ).one_or_none()
    prefs = (row.ai if row is not None else None) or {}
    style = STYLES.get(prefs.get("conversationStyle", ""), "warm and friendly")
    name = row.name if row is not None and row.name else "the user"
    return (
        "You are Isla, the dating companion inside the Love Islander app. "
        f"You are talking with {name}. Be {style}. Give practical, kind advice about dating, conversations and "
        "confidence. Keep replies short (under 120 words). Never ask for or repeat contact details, addresses or "
        "financial information. If the user describes being in danger, tell them to contact local emergency "
        "services and use the Safety page in the app."
    )


async def send(
    session: AsyncSession, llm: LLMProvider, me: uuid.UUID, content: str, per_hour: int
) -> CompanionExchange:
    sent_last_hour = await session.scalar(
        text(
            "SELECT count(*) FROM ai_chat_history WHERE user_id = :me AND role = 'user' "
            "AND created_at > now() - interval '1 hour'"
        ),
        {"me": me},
    )
    if (sent_last_hour or 0) >= per_hour:
        raise AppError(429, "You've reached the hourly limit for the companion. Try again later.", code="rate_limited")

    recent = (await history(session, me, CONTEXT_MESSAGES, None)).messages
    turns = [ChatTurn("system", await _system_prompt(session, me))]
    turns += [ChatTurn(m.role, m.content) for m in recent]
    turns.append(ChatTurn("user", content))
    try:
        reply = await llm.complete(turns)
    except LLMNotConfigured as exc:
        raise AppError(503, "The AI companion is not available right now.", code="ai_not_configured") from exc
    except LLMError as exc:
        raise AppError(502, "The AI companion could not answer; please try again.", code="ai_failed") from exc

    # Both turns are stored only once there is a reply, so a failed call leaves no orphaned question.
    rows = (
        await session.execute(
            text(
                "INSERT INTO ai_chat_history (user_id, role, message_content, message_type, created_at) VALUES "
                "(:me, 'user', :q, 'text', clock_timestamp()), (:me, 'assistant', :a, 'text', clock_timestamp()) "
                "RETURNING id, role, message_content, created_at"
            ),
            {"me": me, "q": content, "a": reply},
        )
    ).all()
    await session.commit()
    by_role = {r.role: _message(r) for r in rows}
    return CompanionExchange(user_message=by_role["user"], reply=by_role["assistant"])


async def proactive_checkins(session: AsyncSession, llm: LLMProvider, *, quiet_hours: int, limit: int) -> int:
    """Sends a short check-in to users who opted in and have not talked to the companion recently."""
    users = (
        await session.scalars(
            text(
                "SELECT s.user_id FROM user_settings s "
                "WHERE (s.preferences -> 'ai_companion_settings' ->> 'allowProactiveMessages')::boolean IS TRUE "
                "AND NOT EXISTS (SELECT 1 FROM ai_chat_history h WHERE h.user_id = s.user_id "
                "AND h.created_at > now() - make_interval(hours => :q)) LIMIT :limit"
            ),
            {"q": quiet_hours, "limit": limit},
        )
    ).all()
    sent = 0
    for user_id in users:
        turns = [
            ChatTurn("system", await _system_prompt(session, user_id)),
            ChatTurn("user", "(The user has not chatted for a while. Send one short, friendly check-in question.)"),
        ]
        try:
            reply = await llm.complete(turns, max_tokens=120)
        except LLMError:
            continue
        await session.execute(
            text(
                "INSERT INTO ai_chat_history (user_id, role, message_content, message_type) "
                "VALUES (:u, 'assistant', :a, 'proactive')"
            ),
            {"u": user_id, "a": reply},
        )
        await session.commit()
        sent += 1
    return sent
