from fastapi import APIRouter, Request, Response

from app.api.deps import CurrentUser, SessionDep
from app.core.rate_limit import limited
from app.schemas.calendar import (
    AuthorizeRequest,
    AuthorizeResponse,
    CalendarEventOut,
    CalendarStatus,
    CallbackRequest,
    CallbackResponse,
)
from app.services import calendar
from app.services.calendar import CalendarConfig

router = APIRouter(prefix="/v1/integrations/google-calendar", tags=["google calendar"])


def _config(request: Request) -> CalendarConfig | None:
    config: CalendarConfig | None = request.app.state.calendar
    return config


@router.get("")
async def read_status(request: Request, user: CurrentUser, session: SessionDep) -> CalendarStatus:
    available, connected = await calendar.status(session, _config(request), user.id)
    return CalendarStatus(available=available, connected=connected)


@router.post("/authorize", dependencies=limited("oauth", 10))
async def authorize(body: AuthorizeRequest, request: Request, user: CurrentUser) -> AuthorizeResponse:
    config = calendar.require(_config(request))
    return AuthorizeResponse(authorization_url=calendar.authorization_url(config, user.id, body.return_to))


@router.post("/callback")
async def callback(body: CallbackRequest, request: Request, user: CurrentUser, session: SessionDep) -> CallbackResponse:
    config = calendar.require(_config(request))
    return_to = await calendar.complete(session, config, user.id, body.code, body.state)
    return CallbackResponse(connected=True, return_to=return_to)


@router.get("/events")
async def events(request: Request, user: CurrentUser, session: SessionDep) -> list[CalendarEventOut]:
    return await calendar.events(session, calendar.require(_config(request)), user.id)


@router.delete("", status_code=204)
async def disconnect(request: Request, user: CurrentUser, session: SessionDep) -> Response:
    await calendar.disconnect(session, _config(request), user.id)
    return Response(status_code=204)
