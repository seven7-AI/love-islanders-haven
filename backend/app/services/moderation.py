"""Roles and report review.

Roles are granted only by an operator (`python -m app.admin roles ...`); the API reads them but never writes them.
"""

import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.pagination import decode_cursor, encode_cursor
from app.schemas.moderation import (
    ModerationReport,
    ModerationReportPage,
    ReportedPerson,
    ReportPerson,
    ReportReview,
    ReportStatus,
)
from app.services.profiles import NotFound

MODERATOR = "moderator"


async def roles_of(session: AsyncSession, user_id: uuid.UUID) -> list[str]:
    rows = await session.scalars(text("SELECT role FROM user_roles WHERE user_id = :id ORDER BY role"), {"id": user_id})
    return list(rows)


async def grant_role(session: AsyncSession, user_id: uuid.UUID, role: str, granted_by: str | None) -> bool:
    """Grants `role`; False if the user already had it. The user must have a profile (signed in to the app once)."""
    if not await session.scalar(text("SELECT EXISTS (SELECT 1 FROM profiles WHERE id = :id)"), {"id": user_id}):
        raise NotFound("Profile")
    granted = await session.scalar(
        text(
            "INSERT INTO user_roles (user_id, role, granted_by) VALUES (:id, :role, :by) "
            "ON CONFLICT (user_id, role) DO NOTHING RETURNING user_id"
        ),
        {"id": user_id, "role": role, "by": granted_by},
    )
    await session.commit()
    return granted is not None


async def revoke_role(session: AsyncSession, user_id: uuid.UUID, role: str) -> bool:
    revoked = await session.scalar(
        text("DELETE FROM user_roles WHERE user_id = :id AND role = :role RETURNING user_id"),
        {"id": user_id, "role": role},
    )
    await session.commit()
    return revoked is not None


async def list_roles(session: AsyncSession) -> list[Any]:
    return list(
        (
            await session.execute(
                text(
                    "SELECT r.user_id, r.role, r.granted_at, r.granted_by, coalesce(p.display_name, p.name) AS name "
                    "FROM user_roles r JOIN profiles p ON p.id = r.user_id ORDER BY r.granted_at"
                )
            )
        ).all()
    )


_REPORTS_SQL = """
SELECT r.id, r.reason, r.details, r.status, r.created_at, r.reviewed_at, r.resolution_note,
       r.reporter_id, coalesce(rp.display_name, rp.name) AS reporter_name, rp.avatar_url AS reporter_photo,
       r.reported_user_id, coalesce(tp.display_name, tp.name) AS reported_name, tp.avatar_url AS reported_photo,
       (SELECT count(*) FROM reports x WHERE x.reported_user_id = r.reported_user_id) AS reports_against,
       r.reviewed_by, coalesce(vp.display_name, vp.name) AS reviewer_name, vp.avatar_url AS reviewer_photo
FROM reports r
JOIN profiles rp ON rp.id = r.reporter_id
JOIN profiles tp ON tp.id = r.reported_user_id
LEFT JOIN profiles vp ON vp.id = r.reviewed_by
"""


def _to_report(row: Any) -> ModerationReport:
    return ModerationReport(
        id=row.id,
        reason=row.reason,
        details=row.details,
        status=row.status,
        created_at=row.created_at,
        reporter=ReportPerson(id=row.reporter_id, name=row.reporter_name, photo_url=row.reporter_photo),
        reported=ReportedPerson(
            id=row.reported_user_id,
            name=row.reported_name,
            photo_url=row.reported_photo,
            reports_against=row.reports_against,
        ),
        reviewed_by=(
            ReportPerson(id=row.reviewed_by, name=row.reviewer_name, photo_url=row.reviewer_photo)
            if row.reviewed_by
            else None
        ),
        reviewed_at=row.reviewed_at,
        resolution_note=row.resolution_note,
    )


async def list_reports(
    session: AsyncSession, *, status: ReportStatus | None, cursor: str | None, limit: int
) -> ModerationReportPage:
    """Oldest first, so the queue is worked in the order reports came in."""
    after_ts, after_id = decode_cursor(cursor) if cursor else (None, None)
    rows = (
        await session.execute(
            text(
                _REPORTS_SQL + "WHERE (CAST(:status AS text) IS NULL OR r.status = :status) "
                "AND (CAST(:ts AS timestamptz) IS NULL OR (r.created_at, r.id) > (:ts, :rid)) "
                "ORDER BY r.created_at, r.id LIMIT :limit"
            ),
            {"status": status, "ts": after_ts, "rid": after_id, "limit": limit + 1},
        )
    ).all()
    page = rows[:limit]
    next_cursor = encode_cursor(page[-1].created_at, page[-1].id) if len(rows) > limit else None
    return ModerationReportPage(reports=[_to_report(r) for r in page], next_cursor=next_cursor)


async def review_report(
    session: AsyncSession, moderator: uuid.UUID, report_id: uuid.UUID, review: ReportReview
) -> ModerationReport:
    involved = (
        await session.execute(
            text("SELECT reporter_id, reported_user_id FROM reports WHERE id = :id FOR UPDATE"), {"id": report_id}
        )
    ).one_or_none()
    if involved is None:
        raise NotFound("Report")
    if moderator in (involved.reporter_id, involved.reported_user_id):
        raise AppError(403, "You cannot review a report that involves you", code="conflict_of_interest")
    await session.execute(
        text(
            "UPDATE reports SET status = :status, resolution_note = coalesce(:note, resolution_note), "
            "reviewed_by = :me, reviewed_at = now() WHERE id = :id"
        ),
        {"status": review.status, "note": review.resolution_note, "me": moderator, "id": report_id},
    )
    await session.commit()
    row = (await session.execute(text(_REPORTS_SQL + "WHERE r.id = :id"), {"id": report_id})).one()
    return _to_report(row)
