from typing import Annotated, Literal

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, SessionDep
from app.schemas.insights import FeedbackCreate, FeedbackItem, Insights
from app.services import insights

router = APIRouter(prefix="/v1", tags=["insights & feedback"])


@router.get("/me/insights")
async def read_insights(
    user: CurrentUser, session: SessionDep, range: Annotated[Literal["week", "month", "year"], Query()] = "month"
) -> Insights:
    return await insights.insights(session, user.id, range)


@router.post("/feedback", status_code=201)
async def send_feedback(body: FeedbackCreate, user: CurrentUser, session: SessionDep) -> FeedbackItem:
    return await insights.add_feedback(session, user.id, body.category, body.content)


@router.get("/feedback")
async def list_feedback(user: CurrentUser, session: SessionDep) -> list[FeedbackItem]:
    return await insights.my_feedback(session, user.id)
