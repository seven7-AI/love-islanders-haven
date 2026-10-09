import uuid
from datetime import date
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

Gender = Literal["male", "female", "non-binary", "other"]
GenderPreference = Literal["male", "female", "both", "everyone"]
RelationshipGoal = Literal["long-term", "casual", "both", "friendship", "not-sure"]
OnboardingStep = Literal["basics", "photos", "interests", "lifestyle", "personality", "preferences", "completed"]

ShortText = Field(default=None, max_length=100)


class ImageOut(BaseModel):
    id: uuid.UUID
    url: str
    position: int
    is_visible: bool


class ProfileUpdate(BaseModel):
    """Fields a user may change on their own profile. Unknown fields are rejected; server-managed fields
    (verified, email_verified, streak_count, age) are not accepted."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=60)
    display_name: str | None = Field(default=None, max_length=60)
    bio: str | None = Field(default=None, max_length=500)
    dob: date | None = None
    gender: Gender | None = None
    gender_preference: GenderPreference | None = None
    relationship_goal: RelationshipGoal | None = None
    height_cm: int | None = Field(default=None, ge=100, le=250)
    occupation: str | None = ShortText
    education: str | None = ShortText
    exercise: str | None = ShortText
    drinking_habit: str | None = ShortText
    smoking_habit: str | None = ShortText
    communication_style: str | None = ShortText
    love_language: str | None = ShortText
    zodiac_sign: str | None = ShortText
    hometown: str | None = ShortText
    pronouns: str | None = Field(default=None, max_length=30)
    location: str | None = ShortText
    city: str | None = ShortText
    country: str | None = ShortText
    interests: list[str] | None = Field(default=None, max_length=20)
    age_range_min: int | None = Field(default=None, ge=18, le=100)
    age_range_max: int | None = Field(default=None, ge=18, le=100)
    distance_preference: int | None = Field(default=None, ge=1, le=500)
    show_age: bool | None = None
    show_me_verified_only: bool | None = None

    @model_validator(mode="after")
    def _check(self) -> Self:
        if (
            self.age_range_min is not None
            and self.age_range_max is not None
            and self.age_range_min > self.age_range_max
        ):
            raise ValueError("age_range_min must not exceed age_range_max")
        if self.interests is not None and any(not 0 < len(i) <= 40 for i in self.interests):
            raise ValueError("each interest must be 1-40 characters")
        return self


class OwnProfile(BaseModel):
    id: uuid.UUID
    name: str | None
    display_name: str | None
    bio: str | None
    dob: date | None
    age: int | None
    gender: str | None
    gender_preference: str | None
    relationship_goal: str | None
    height_cm: int | None
    occupation: str | None
    education: str | None
    exercise: str | None
    drinking_habit: str | None
    smoking_habit: str | None
    communication_style: str | None
    love_language: str | None
    zodiac_sign: str | None
    hometown: str | None
    pronouns: str | None
    location: str | None
    city: str | None
    country: str | None
    interests: list[str]
    age_range_min: int | None
    age_range_max: int | None
    distance_preference: int | None
    show_age: bool
    show_me_verified_only: bool
    verified: bool
    email_verified: bool
    streak_count: int
    onboarding_completed: bool
    onboarding_step: str | None
    images: list[ImageOut]


class PublicProfile(BaseModel):
    """What other signed-in users may see: no date of birth, age only if the owner shows it, visible images only."""

    id: uuid.UUID
    name: str | None
    bio: str | None
    age: int | None
    gender: str | None
    relationship_goal: str | None
    height_cm: int | None
    occupation: str | None
    education: str | None
    city: str | None
    country: str | None
    pronouns: str | None
    interests: list[str]
    verified: bool
    images: list[str]
    # Rounded to whole kilometres; null when either person has not shared a location.
    distance_km: int | None = None


class OnboardingStepUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    step: OnboardingStep


class UploadRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    content_type: Literal["image/jpeg", "image/png", "image/webp"]
    size_bytes: int = Field(gt=0, le=5 * 1024 * 1024)


class UploadTicket(BaseModel):
    bucket: str
    path: str
    token: str
    upload_url: str


class ImageRegister(BaseModel):
    model_config = ConfigDict(extra="forbid")
    path: str = Field(min_length=1, max_length=200)


class ImageUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    is_visible: bool


class ImageOrder(BaseModel):
    model_config = ConfigDict(extra="forbid")
    image_ids: list[uuid.UUID] = Field(min_length=1, max_length=6)


class LocationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
