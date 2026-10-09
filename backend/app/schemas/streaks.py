import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class StreakPost(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    author_name: str | None
    author_photo_url: str | None
    images: list[str]
    caption: str | None
    streak_count: int
    likes_count: int
    liked_by_me: bool
    created_at: datetime
    expires_at: datetime | None


class StreakFeed(BaseModel):
    posts: list[StreakPost]
    next_cursor: str | None


class StreakCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    media_paths: list[str] = Field(min_length=1, max_length=5)
    caption: str | None = Field(default=None, max_length=300)
    duration_hours: int = Field(default=24, ge=1, le=72)


class StreakStatus(BaseModel):
    has_posted_today: bool
    streak_count: int


class LeaderboardEntry(BaseModel):
    user_id: uuid.UUID
    name: str | None
    streak_count: int


class LikeState(BaseModel):
    liked: bool
    likes_count: int
