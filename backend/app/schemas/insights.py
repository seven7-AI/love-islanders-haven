import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Bucket(BaseModel):
    label: str
    count: int


class Insights(BaseModel):
    range: Literal["week", "month", "year"]
    times_shown: int
    likes_received: int
    matches: int
    messages_sent: int
    like_to_match_rate: float | None
    reply_rate: float | None
    average_reply_minutes: float | None
    liker_ages: list[Bucket]
    liker_cities: list[Bucket]


class FeedbackCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    category: Literal["general", "ui", "bug", "feature", "safety", "other"] = "general"
    content: str = Field(min_length=3, max_length=2000)


class FeedbackItem(BaseModel):
    id: uuid.UUID
    category: str
    content: str
    created_at: datetime
