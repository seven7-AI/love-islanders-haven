import uuid
from datetime import datetime
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

ContentType = Literal["text", "image", "audio"]


class MessageOut(BaseModel):
    id: uuid.UUID
    match_id: uuid.UUID
    sender_id: uuid.UUID
    content: str
    content_type: ContentType
    media_url: str | None
    is_read: bool
    created_at: datetime


class MessagePage(BaseModel):
    """Messages in chronological order. `older_cursor` fetches the page before the first message."""

    messages: list[MessageOut]
    older_cursor: str | None


class MessageCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    content: str = Field(default="", max_length=2000)
    content_type: ContentType = "text"
    media_path: str | None = Field(default=None, max_length=200)

    @model_validator(mode="after")
    def _check(self) -> Self:
        if self.content_type == "text":
            if not self.content.strip():
                raise ValueError("A text message cannot be empty")
            if self.media_path is not None:
                raise ValueError("Text messages cannot carry media")
        elif self.media_path is None:
            raise ValueError("Media messages need media_path from an upload ticket")
        return self


class MediaUploadRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    content_type: Literal["image/jpeg", "image/png", "image/webp", "audio/webm", "audio/mpeg", "audio/mp4", "audio/ogg"]
    size_bytes: int = Field(gt=0, le=10 * 1024 * 1024)


class ReadReceipt(BaseModel):
    marked_read: int
