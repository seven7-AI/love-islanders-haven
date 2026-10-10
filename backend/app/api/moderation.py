import uuid
from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import ModeratorUser, SessionDep
from app.schemas.moderation import ModerationReport, ModerationReportPage, ReportReview, ReportStatus
from app.services import moderation

router = APIRouter(prefix="/v1/moderation", tags=["moderation"])


@router.get("/reports")
async def list_reports(
    user: ModeratorUser,
    session: SessionDep,
    status: ReportStatus | None = None,
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
) -> ModerationReportPage:
    """Reports, oldest first, optionally only those with one status. Moderators only."""
    return await moderation.list_reports(session, status=status, cursor=cursor, limit=limit)


@router.patch("/reports/{report_id}")
async def review_report(
    report_id: uuid.UUID, body: ReportReview, user: ModeratorUser, session: SessionDep
) -> ModerationReport:
    """Sets the status (and optionally a note); records the moderator and the time. Moderators only, and not on
    reports they filed or that are about them."""
    return await moderation.review_report(session, user.id, report_id, body)
