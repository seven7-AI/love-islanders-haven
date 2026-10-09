"""Profile insights computed from real activity (no estimates or sample data)."""

import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.insights import Bucket, FeedbackItem, Insights

RANGE_DAYS = {"week": 7, "month": 30, "year": 365}

_COUNTS_SQL = """
SELECT
  (SELECT count(*) FROM swipes WHERE swiped_user_id = :me AND created_at >= :since) AS times_shown,
  (SELECT count(*) FROM swipes WHERE swiped_user_id = :me AND direction IN ('right', 'super')
     AND created_at >= :since) AS likes_received,
  (SELECT count(*) FROM matches WHERE :me IN (user_id, matched_user_id) AND created_at >= :since) AS matches,
  (SELECT count(*) FROM messages WHERE sender_id = :me AND created_at >= :since) AS messages_sent
"""

# For each of my messages that answers the other person (the previous message in the match was theirs), the time
# since that previous message. Reply rate: share of conversations where they wrote and I wrote back afterwards.
_REPLIES_SQL = """
WITH my_matches AS (
  SELECT id FROM matches WHERE :me IN (user_id, matched_user_id)
),
ordered AS (
  SELECT m.match_id, m.sender_id, m.created_at,
         lag(m.sender_id) OVER w AS prev_sender, lag(m.created_at) OVER w AS prev_at
  FROM messages m JOIN my_matches mm ON mm.id = m.match_id
  WINDOW w AS (PARTITION BY m.match_id ORDER BY m.created_at, m.id)
),
replies AS (
  SELECT match_id, extract(epoch FROM created_at - prev_at) / 60 AS minutes
  FROM ordered
  WHERE sender_id = :me AND prev_sender IS NOT NULL AND prev_sender <> :me AND created_at >= :since
),
received AS (
  SELECT DISTINCT match_id FROM ordered WHERE sender_id <> :me AND created_at >= :since
)
SELECT (SELECT avg(minutes) FROM replies) AS average_minutes,
       (SELECT count(*) FROM received) AS conversations,
       (SELECT count(DISTINCT r.match_id) FROM replies r JOIN received USING (match_id)) AS answered
"""

_AGES_SQL = """
SELECT CASE WHEN a < 25 THEN '18-24' WHEN a < 31 THEN '25-30' WHEN a < 36 THEN '31-35'
            WHEN a < 41 THEN '36-40' ELSE '41+' END AS label, count(*) AS count
FROM (
  SELECT coalesce(date_part('year', age(current_date, p.dob))::int, p.age) AS a
  FROM swipes s JOIN profiles p ON p.id = s.user_id
  WHERE s.swiped_user_id = :me AND s.direction IN ('right', 'super') AND s.created_at >= :since
) likers
WHERE a IS NOT NULL
GROUP BY 1 ORDER BY 1
"""

_CITIES_SQL = """
SELECT p.city AS label, count(*) AS count
FROM swipes s JOIN profiles p ON p.id = s.user_id
WHERE s.swiped_user_id = :me AND s.direction IN ('right', 'super') AND s.created_at >= :since
  AND p.city IS NOT NULL AND p.city <> ''
GROUP BY p.city ORDER BY count(*) DESC, p.city LIMIT 5
"""


async def insights(session: AsyncSession, me: uuid.UUID, range_: str) -> Insights:
    since = (
        await session.execute(text("SELECT now() - make_interval(days => :d)"), {"d": RANGE_DAYS[range_]})
    ).scalar_one()
    params = {"me": me, "since": since}
    counts = (await session.execute(text(_COUNTS_SQL), params)).one()
    replies = (await session.execute(text(_REPLIES_SQL), params)).one()
    ages = (await session.execute(text(_AGES_SQL), params)).all()
    cities = (await session.execute(text(_CITIES_SQL), params)).all()
    return Insights(
        range=range_,
        times_shown=counts.times_shown,
        likes_received=counts.likes_received,
        matches=counts.matches,
        messages_sent=counts.messages_sent,
        like_to_match_rate=round(counts.matches / counts.likes_received, 3) if counts.likes_received else None,
        reply_rate=round(replies.answered / replies.conversations, 3) if replies.conversations else None,
        average_reply_minutes=round(float(replies.average_minutes), 1) if replies.average_minutes is not None else None,
        liker_ages=[Bucket(label=r.label, count=r.count) for r in ages],
        liker_cities=[Bucket(label=r.label, count=r.count) for r in cities],
    )


async def add_feedback(session: AsyncSession, me: uuid.UUID, category: str, content: str) -> FeedbackItem:
    row = (
        await session.execute(
            text(
                "INSERT INTO user_feedback (user_id, feedback_type, feedback_content) VALUES (:me, :c, :t) "
                "RETURNING id, feedback_type, feedback_content, created_at"
            ),
            {"me": me, "c": category, "t": content.strip()},
        )
    ).one()
    await session.commit()
    return FeedbackItem(id=row[0], category=row[1], content=row[2], created_at=row[3])


async def my_feedback(session: AsyncSession, me: uuid.UUID) -> list[FeedbackItem]:
    rows = (
        await session.execute(
            text(
                "SELECT id, feedback_type, feedback_content, created_at FROM user_feedback WHERE user_id = :me "
                "ORDER BY created_at DESC LIMIT 100"
            ),
            {"me": me},
        )
    ).all()
    return [FeedbackItem(id=r[0], category=r[1], content=r[2], created_at=r[3]) for r in rows]
