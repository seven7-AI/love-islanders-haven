import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.schemas.profile import PublicProfile


class DiscoverPage(BaseModel):
    profiles: list[PublicProfile]
    next_cursor: str | None


class SwipeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    target_id: uuid.UUID
    direction: Literal["left", "right", "super"]


class SwipeResult(BaseModel):
    matched: bool
    match_id: uuid.UUID | None


class MatchPartner(BaseModel):
    id: uuid.UUID
    name: str | None
    age: int | None
    photo_url: str | None


class LastMessage(BaseModel):
    content: str
    sender_id: uuid.UUID
    created_at: datetime


class MatchSummary(BaseModel):
    id: uuid.UUID
    created_at: datetime
    partner: MatchPartner
    last_message: LastMessage | None
    unread_count: int


class MatchPage(BaseModel):
    matches: list[MatchSummary]
    next_cursor: str | None
