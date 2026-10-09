from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, SessionDep
from app.core.errors import AppError
from app.schemas.notifications import MarkRead, NotificationPage
from app.services import notifications

router = APIRouter(prefix="/v1/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(
    user: CurrentUser, session: SessionDep, limit: Annotated[int, Query(ge=1, le=50)] = 20, cursor: str | None = None
) -> NotificationPage:
    return await notifications.list_notifications(session, user.id, limit, cursor)


@router.post("/read")
async def mark_read(body: MarkRead, user: CurrentUser, session: SessionDep) -> dict[str, int]:
    if not body.all and not body.ids:
        raise AppError(422, "Give notification ids or all=true", code="nothing_to_mark")
    return {"marked_read": await notifications.mark_read(session, user.id, body.ids, body.all)}
