import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class NotificationOut(BaseModel):
    id: uuid.UUID
    type: Literal["match", "message", "streak_like"]
    actor_id: uuid.UUID | None
    actor_name: str | None
    actor_photo_url: str | None
    match_id: uuid.UUID | None
    streak_id: uuid.UUID | None
    is_read: bool
    created_at: datetime


class NotificationPage(BaseModel):
    notifications: list[NotificationOut]
    unread_count: int
    next_cursor: str | None


class MarkRead(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ids: list[uuid.UUID] | None = Field(default=None, max_length=100)
    all: bool = False
