"""Relational schema of the app.

Table and column names match the Supabase `public` schema so that data can be moved with a plain
dump/restore. Supabase-only pieces (the FK from profiles.id to auth.users, RLS policies, auth
triggers) are not part of this model; see docs/database/migrations.md.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    ARRAY,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

NAMING_CONVENTION = {
    "ix": "%(table_name)s_%(column_0_N_name)s_idx",
    "uq": "%(table_name)s_%(column_0_N_name)s_key",
    "ck": "%(table_name)s_%(constraint_name)s",
    "fk": "%(table_name)s_%(column_0_name)s_fkey",
    "pk": "%(table_name)s_pkey",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))


def _created_at() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


def _updated_at() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


def _profile_fk(*, nullable: bool = False) -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=nullable)


class Profile(Base):
    __tablename__ = "profiles"

    # Equals the auth provider's user id (Supabase auth.users.id).
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    name: Mapped[str | None] = mapped_column(Text)
    avatar_url: Mapped[str | None] = mapped_column(Text)
    bio: Mapped[str | None] = mapped_column(Text)
    age: Mapped[int | None] = mapped_column(Integer)
    location: Mapped[str | None] = mapped_column(Text)
    interests: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    verified: Mapped[bool | None] = mapped_column(Boolean, server_default=text("false"))
    email_verified: Mapped[bool | None] = mapped_column(Boolean, server_default=text("false"))
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = _updated_at()
    streak_count: Mapped[int | None] = mapped_column(Integer, server_default=text("0"))
    dob: Mapped[date | None] = mapped_column(Date)
    gender: Mapped[str | None] = mapped_column(Text)
    gender_preference: Mapped[str | None] = mapped_column(Text)
    height_cm: Mapped[int | None] = mapped_column(Integer)
    occupation: Mapped[str | None] = mapped_column(Text)
    education: Mapped[str | None] = mapped_column(Text)
    exercise: Mapped[str | None] = mapped_column(Text)
    drinking_habit: Mapped[str | None] = mapped_column(Text)
    smoking_habit: Mapped[str | None] = mapped_column(Text)
    relationship_goal: Mapped[str | None] = mapped_column(Text)
    communication_style: Mapped[str | None] = mapped_column(Text)
    love_language: Mapped[str | None] = mapped_column(Text)
    zodiac_sign: Mapped[str | None] = mapped_column(Text)
    hometown: Mapped[str | None] = mapped_column(Text)
    pronouns: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(Text)
    country: Mapped[str | None] = mapped_column(Text)
    display_name: Mapped[str | None] = mapped_column(Text)
    age_range_min: Mapped[int | None] = mapped_column(Integer, server_default=text("18"))
    age_range_max: Mapped[int | None] = mapped_column(Integer, server_default=text("35"))
    distance_preference: Mapped[int | None] = mapped_column(Integer, server_default=text("25"))
    show_me_verified_only: Mapped[bool | None] = mapped_column(Boolean, server_default=text("false"))
    show_age: Mapped[bool | None] = mapped_column(Boolean, server_default=text("true"))
    onboarding_completed: Mapped[bool | None] = mapped_column(Boolean, server_default=text("false"))


class ProfileOnboarding(Base):
    __tablename__ = "profile_onboarding"

    id: Mapped[uuid.UUID] = _uuid_pk()
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    completed: Mapped[bool | None] = mapped_column(Boolean, server_default=text("false"))
    current_step: Mapped[str | None] = mapped_column(Text, server_default=text("'basics'::text"))
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = _updated_at()


class ProfileImage(Base):
    __tablename__ = "profile_images"
    __table_args__ = (Index("profile_images_profile_idx", "profile_id", "position"),)

    id: Mapped[uuid.UUID] = _uuid_pk()
    profile_id: Mapped[uuid.UUID] = _profile_fk()
    url: Mapped[str] = mapped_column(Text, nullable=False)
    position: Mapped[int | None] = mapped_column(Integer, server_default=text("0"))
    is_visible: Mapped[bool | None] = mapped_column(Boolean, server_default=text("true"))
    created_at: Mapped[datetime] = _created_at()


class AIChatHistory(Base):
    __tablename__ = "ai_chat_history"
    __table_args__ = (Index("ai_chat_history_user_created_idx", "user_id", "created_at"),)

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = _profile_fk()
    role: Mapped[str] = mapped_column(Text, nullable=False)
    message_content: Mapped[str] = mapped_column(Text, nullable=False)
    message_type: Mapped[str | None] = mapped_column(Text, server_default=text("'text'::text"))
    created_at: Mapped[datetime] = _created_at()


class UserFeedback(Base):
    __tablename__ = "user_feedback"
    __table_args__ = (Index("user_feedback_user_idx", "user_id"),)

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = _profile_fk()
    feedback_type: Mapped[str] = mapped_column(Text, nullable=False)
    feedback_content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = _created_at()


class BlockedUser(Base):
    __tablename__ = "blocked_users"
    __table_args__ = (
        UniqueConstraint("user_id", "blocked_user_id"),
        Index("blocked_users_blocked_idx", "blocked_user_id"),
    )

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = _profile_fk()
    blocked_user_id: Mapped[uuid.UUID] = _profile_fk()
    created_at: Mapped[datetime] = _created_at()


class SafetyContact(Base):
    __tablename__ = "safety_contacts"
    __table_args__ = (Index("safety_contacts_user_idx", "user_id"),)

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = _profile_fk()
    contact_name: Mapped[str] = mapped_column(Text, nullable=False)
    contact_phone: Mapped[str | None] = mapped_column(Text)
    contact_email: Mapped[str | None] = mapped_column(Text)
    is_primary: Mapped[bool | None] = mapped_column(Boolean, server_default=text("false"))
    created_at: Mapped[datetime] = _created_at()
    # Duplicates of contact_name/contact_phone written by older client code; kept until #17 consolidates them.
    name: Mapped[str | None] = mapped_column(Text)
    phone_number: Mapped[str | None] = mapped_column(Text)


class DatePlan(Base):
    __tablename__ = "date_plans"
    __table_args__ = (Index("date_plans_user_idx", "user_id"),)

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = _profile_fk()
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(Text)
    date_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    partner_name: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str | None] = mapped_column(Text, server_default=text("'planned'::text"))
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = _updated_at()
    notes: Mapped[str | None] = mapped_column(Text)
    contact_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("safety_contacts.id"))
    location_sharing_enabled: Mapped[bool | None] = mapped_column(Boolean, server_default=text("false"))


class Match(Base):
    __tablename__ = "matches"
    __table_args__ = (
        UniqueConstraint("user_id", "matched_user_id"),
        Index("matches_matched_user_idx", "matched_user_id"),
        Index(
            "matches_pair_unique",
            func.least(text("user_id"), text("matched_user_id")),
            func.greatest(text("user_id"), text("matched_user_id")),
            unique=True,
        ),
    )

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = _profile_fk()
    matched_user_id: Mapped[uuid.UUID] = _profile_fk()
    status: Mapped[str | None] = mapped_column(Text, server_default=text("'pending'::text"))
    created_at: Mapped[datetime] = _created_at()


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        Index("messages_match_created_idx", "match_id", "created_at"),
        Index("messages_sender_idx", "sender_id"),
    )

    id: Mapped[uuid.UUID] = _uuid_pk()
    match_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("matches.id", ondelete="CASCADE"), nullable=False
    )
    sender_id: Mapped[uuid.UUID] = _profile_fk()
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str | None] = mapped_column(Text, server_default=text("'text'::text"))
    media_url: Mapped[str | None] = mapped_column(Text)
    is_read: Mapped[bool | None] = mapped_column(Boolean, server_default=text("false"))
    created_at: Mapped[datetime] = _created_at()


class Swipe(Base):
    __tablename__ = "swipes"
    __table_args__ = (
        UniqueConstraint("user_id", "swiped_user_id"),
        CheckConstraint("direction = ANY (ARRAY['left'::text, 'right'::text, 'super'::text])", name="direction_check"),
        CheckConstraint("user_id <> swiped_user_id", name="not_self"),
        Index("swipes_swiped_idx", "swiped_user_id"),
    )

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = _profile_fk()
    swiped_user_id: Mapped[uuid.UUID] = _profile_fk()
    direction: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = _created_at()


class UserSettings(Base):
    __tablename__ = "user_settings"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    notifications_enabled: Mapped[bool | None] = mapped_column(Boolean, server_default=text("true"))
    location_sharing: Mapped[bool | None] = mapped_column(Boolean, server_default=text("false"))
    show_online_status: Mapped[bool | None] = mapped_column(Boolean, server_default=text("true"))
    theme: Mapped[str | None] = mapped_column(Text, server_default=text("'system'::text"))
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = _updated_at()


class Streak(Base):
    __tablename__ = "streaks"
    __table_args__ = (Index("streaks_user_created_idx", "user_id", "created_at"),)

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = _profile_fk()
    content: Mapped[str] = mapped_column(Text, nullable=False)
    caption: Mapped[str | None] = mapped_column(Text)
    streak_count: Mapped[int | None] = mapped_column(Integer, server_default=text("1"))
    likes_count: Mapped[int | None] = mapped_column(Integer, server_default=text("0"))
    comments_count: Mapped[int | None] = mapped_column(Integer, server_default=text("0"))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = _created_at()


class StreakLike(Base):
    __tablename__ = "streak_likes"
    __table_args__ = (
        UniqueConstraint("user_id", "streak_id"),
        Index("streak_likes_streak_idx", "streak_id"),
    )

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = _profile_fk()
    streak_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("streaks.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = _created_at()


# Tables whose updated_at column is maintained by the set_updated_at() trigger.
TABLES_WITH_UPDATED_AT = ("profiles", "profile_onboarding", "date_plans", "user_settings")
