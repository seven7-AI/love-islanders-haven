import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class CompanionMessage(BaseModel):
    id: uuid.UUID
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime


class CompanionHistory(BaseModel):
    messages: list[CompanionMessage]
    older_cursor: str | None


class CompanionSend(BaseModel):
    model_config = ConfigDict(extra="forbid")
    content: str = Field(min_length=1, max_length=2000)


class CompanionExchange(BaseModel):
    user_message: CompanionMessage
    reply: CompanionMessage
