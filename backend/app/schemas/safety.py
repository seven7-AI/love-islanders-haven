import uuid
from datetime import datetime
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

ReportReason = Literal["harassment", "spam", "fake_profile", "inappropriate_content", "underage", "other"]
Phone = Field(default=None, pattern=r"^\+?[0-9 ()\-]{6,20}$")


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class BlockCreate(_Strict):
    user_id: uuid.UUID


class BlockedUser(BaseModel):
    user_id: uuid.UUID
    name: str | None
    photo_url: str | None
    blocked_at: datetime


class ReportCreate(_Strict):
    user_id: uuid.UUID
    reason: ReportReason
    details: str | None = Field(default=None, max_length=1000)
    also_block: bool = False


class ReportCreated(BaseModel):
    id: uuid.UUID


class ContactCreate(_Strict):
    name: str = Field(min_length=1, max_length=80)
    phone: str | None = Phone
    email: EmailStr | None = None
    is_primary: bool = False

    @model_validator(mode="after")
    def _reachable(self) -> Self:
        if not self.phone and not self.email:
            raise ValueError("A safety contact needs a phone number or an email address")
        return self


class ContactUpdate(_Strict):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    phone: str | None = Phone
    email: EmailStr | None = None
    is_primary: bool | None = None


class Contact(BaseModel):
    id: uuid.UUID
    name: str
    phone: str | None
    email: str | None
    is_primary: bool


DatePlanStatus = Literal["planned", "completed", "cancelled"]


class DatePlanCreate(_Strict):
    title: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    location: str | None = Field(default=None, max_length=200)
    date_time: datetime | None = None
    partner_name: str | None = Field(default=None, max_length=80)
    notes: str | None = Field(default=None, max_length=1000)
    contact_id: uuid.UUID | None = None
    location_sharing_enabled: bool = False


class DatePlanUpdate(_Strict):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    location: str | None = Field(default=None, max_length=200)
    date_time: datetime | None = None
    partner_name: str | None = Field(default=None, max_length=80)
    notes: str | None = Field(default=None, max_length=1000)
    contact_id: uuid.UUID | None = None
    location_sharing_enabled: bool | None = None
    status: DatePlanStatus | None = None


class DatePlan(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    location: str | None
    date_time: datetime | None
    partner_name: str | None
    status: str
    notes: str | None
    contact_id: uuid.UUID | None
    location_sharing_enabled: bool


class AlertRequest(_Strict):
    message: str | None = Field(default=None, max_length=500)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
