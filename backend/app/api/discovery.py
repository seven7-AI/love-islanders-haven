import uuid
from typing import Annotated

from fastapi import APIRouter, Query, Response

from app.api.deps import CurrentUser, SessionDep
from app.core.rate_limit import limited
from app.schemas.discovery import DiscoverPage, MatchPage, SwipeRequest, SwipeResult
from app.services import discovery

router = APIRouter(prefix="/v1", tags=["discovery"])

Limit = Annotated[int, Query(ge=1, le=50)]


@router.get("/discover")
async def discover(
    user: CurrentUser, session: SessionDep, limit: Limit = 20, cursor: str | None = None
) -> DiscoverPage:
    return await discovery.discover(session, user.id, limit, cursor)


@router.post("/swipes", status_code=201, dependencies=limited("swipes", 120))
async def swipe(body: SwipeRequest, user: CurrentUser, session: SessionDep) -> SwipeResult:
    return await discovery.swipe(session, user.id, body.target_id, body.direction)


@router.get("/matches")
async def list_matches(
    user: CurrentUser, session: SessionDep, limit: Limit = 20, cursor: str | None = None
) -> MatchPage:
    return await discovery.list_matches(session, user.id, limit, cursor)


@router.delete("/matches/{match_id}", status_code=204)
async def unmatch(match_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> Response:
    await discovery.unmatch(session, user.id, match_id)
    return Response(status_code=204)
