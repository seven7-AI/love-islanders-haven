from typing import Annotated

from fastapi import APIRouter, Query, Request

from app.api.deps import CurrentUser, SessionDep
from app.integrations.llm import LLMProvider
from app.schemas.companion import CompanionExchange, CompanionHistory, CompanionSend
from app.services import companion

router = APIRouter(prefix="/v1/companion", tags=["ai companion"])


@router.get("/messages")
async def history(
    user: CurrentUser, session: SessionDep, limit: Annotated[int, Query(ge=1, le=100)] = 50, before: str | None = None
) -> CompanionHistory:
    return await companion.history(session, user.id, limit, before)


@router.post("/messages", status_code=201)
async def send(body: CompanionSend, request: Request, user: CurrentUser, session: SessionDep) -> CompanionExchange:
    llm: LLMProvider = request.app.state.llm
    per_hour: int = request.app.state.settings.companion_messages_per_hour
    return await companion.send(session, llm, user.id, body.content, per_hour)
