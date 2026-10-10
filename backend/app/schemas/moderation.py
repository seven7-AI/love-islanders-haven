import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.safety import ReportReason

ReportStatus = Literal["open", "reviewing", "resolved", "dismissed"]
Role = Literal["moderator"]


class ReportPerson(BaseModel):
    id: uuid.UUID
    name: str | None
    photo_url: str | None


class ReportedPerson(ReportPerson):
    # All reports filed against this person, including this one; repeated reports are a signal for the reviewer.
    reports_against: int


class ModerationReport(BaseModel):
    id: uuid.UUID
    reason: ReportReason
    details: str | None
    status: ReportStatus
    created_at: datetime
    reporter: ReportPerson
    reported: ReportedPerson
    reviewed_by: ReportPerson | None
    reviewed_at: datetime | None
    resolution_note: str | None


class ModerationReportPage(BaseModel):
    reports: list[ModerationReport]
    next_cursor: str | None


class ReportReview(BaseModel):
    model_config = ConfigDict(extra="forbid")
    # A report cannot be reopened; "reviewing" marks it as taken.
    status: Literal["reviewing", "resolved", "dismissed"]
    resolution_note: str | None = Field(default=None, max_length=1000)
