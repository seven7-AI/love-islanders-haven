from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import text

from app.api.deps import CurrentUser, SessionDep
from app.services.moderation import roles_of

router = APIRouter(prefix="/v1", tags=["me"])


class MeResponse(BaseModel):
    id: str
    email: str | None
    name: str | None
    onboarding_completed: bool
    email_verified: bool
    # Extra permissions granted by an operator, e.g. ["moderator"]; empty for most users.
    roles: list[str]


@router.get("/me")
async def read_me(user: CurrentUser, session: SessionDep) -> MeResponse:
    row: Any = (
        await session.execute(
            text("SELECT name, onboarding_completed, email_verified FROM profiles WHERE id = :id"),
            {"id": user.id},
        )
    ).one()
    return MeResponse(
        id=str(user.id),
        email=user.email,
        name=row.name,
        onboarding_completed=bool(row.onboarding_completed),
        email_verified=bool(row.email_verified),
        roles=await roles_of(session, user.id),
    )
