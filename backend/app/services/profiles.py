"""Profile, onboarding and profile-image rules."""

import uuid
from datetime import date

from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.models import Profile, ProfileImage, ProfileOnboarding
from app.integrations.storage import SignedUpload, StorageError, StorageNotConfigured, StorageProvider
from app.schemas.profile import ImageOut, OwnProfile, ProfileUpdate, PublicProfile

MINIMUM_AGE = 18
MAX_IMAGES = 6
MIN_PHOTOS_TO_COMPLETE = 4
EXTENSIONS = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


def age_on(dob: date, today: date) -> int:
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def current_age(profile: Profile) -> int | None:
    """Age today; the stored age column is only as fresh as the last profile update."""
    return age_on(profile.dob, date.today()) if profile.dob else profile.age


class NotFound(AppError):
    def __init__(self, what: str) -> None:
        super().__init__(404, f"{what} not found", code="not_found")


def _storage_unavailable(exc: StorageError) -> AppError:
    if isinstance(exc, StorageNotConfigured):
        return AppError(503, "Image storage is not configured", code="storage_not_configured")
    return AppError(502, "The image storage service failed; please try again", code="storage_failed")


async def _images(session: AsyncSession, profile_id: uuid.UUID, *, visible_only: bool) -> list[ProfileImage]:
    query = select(ProfileImage).where(ProfileImage.profile_id == profile_id)
    if visible_only:
        query = query.where(ProfileImage.is_visible.is_not(False))
    query = query.order_by(ProfileImage.position, ProfileImage.created_at)
    return list((await session.scalars(query)).all())


async def get_own_profile(session: AsyncSession, user_id: uuid.UUID) -> OwnProfile:
    profile = await session.get(Profile, user_id)
    if profile is None:
        raise NotFound("Profile")
    step = await session.scalar(select(ProfileOnboarding.current_step).where(ProfileOnboarding.profile_id == user_id))
    images = await _images(session, user_id, visible_only=False)
    return OwnProfile(
        id=profile.id,
        name=profile.name,
        display_name=profile.display_name,
        bio=profile.bio,
        dob=profile.dob,
        age=current_age(profile),
        gender=profile.gender,
        gender_preference=profile.gender_preference,
        relationship_goal=profile.relationship_goal,
        height_cm=profile.height_cm,
        occupation=profile.occupation,
        education=profile.education,
        exercise=profile.exercise,
        drinking_habit=profile.drinking_habit,
        smoking_habit=profile.smoking_habit,
        communication_style=profile.communication_style,
        love_language=profile.love_language,
        zodiac_sign=profile.zodiac_sign,
        hometown=profile.hometown,
        pronouns=profile.pronouns,
        location=profile.location,
        city=profile.city,
        country=profile.country,
        interests=profile.interests or [],
        age_range_min=profile.age_range_min,
        age_range_max=profile.age_range_max,
        distance_preference=profile.distance_preference,
        show_age=profile.show_age is not False,
        show_me_verified_only=bool(profile.show_me_verified_only),
        verified=bool(profile.verified),
        email_verified=bool(profile.email_verified),
        streak_count=profile.streak_count or 0,
        onboarding_completed=bool(profile.onboarding_completed),
        onboarding_step=step,
        images=[
            ImageOut(id=i.id, url=i.url, position=i.position or 0, is_visible=i.is_visible is not False) for i in images
        ],
    )


async def update_profile(session: AsyncSession, user_id: uuid.UUID, changes: ProfileUpdate) -> OwnProfile:
    values = changes.model_dump(exclude_unset=True)
    if "dob" in values:
        dob: date | None = values["dob"]
        if dob is None:
            values["age"] = None
        else:
            age = age_on(dob, date.today())
            if age < MINIMUM_AGE:
                raise AppError(422, f"You must be at least {MINIMUM_AGE} years old", code="underage")
            values["age"] = age
    profile = await session.get(Profile, user_id)
    if profile is None:
        raise NotFound("Profile")
    if values:
        await session.execute(update(Profile).where(Profile.id == user_id).values(**values))
        await session.commit()
    return await get_own_profile(session, user_id)


async def set_onboarding_step(session: AsyncSession, user_id: uuid.UUID, step: str) -> OwnProfile:
    if step == "completed":
        profile = await session.get(Profile, user_id)
        if profile is None:
            raise NotFound("Profile")
        missing = [f for f in ("name", "dob", "gender", "gender_preference") if not getattr(profile, f)]
        image_count = await session.scalar(
            select(func.count()).select_from(ProfileImage).where(ProfileImage.profile_id == user_id)
        )
        if (image_count or 0) < MIN_PHOTOS_TO_COMPLETE:
            missing.append(f"at least {MIN_PHOTOS_TO_COMPLETE} photos")
        if missing:
            raise AppError(422, "Onboarding is incomplete: " + ", ".join(missing), code="onboarding_incomplete")
        await session.execute(update(Profile).where(Profile.id == user_id).values(onboarding_completed=True))
    await session.execute(
        text(
            "INSERT INTO profile_onboarding (profile_id, current_step, completed) VALUES (:id, :step, :done) "
            "ON CONFLICT (profile_id) DO UPDATE SET current_step = :step, completed = :done"
        ),
        {"id": user_id, "step": step, "done": step == "completed"},
    )
    await session.commit()
    return await get_own_profile(session, user_id)


async def get_public_profile(session: AsyncSession, viewer_id: uuid.UUID, profile_id: uuid.UUID) -> PublicProfile:
    blocked = await session.scalar(
        text(
            "SELECT EXISTS (SELECT 1 FROM blocked_users WHERE (user_id = :a AND blocked_user_id = :b) "
            "OR (user_id = :b AND blocked_user_id = :a))"
        ),
        {"a": viewer_id, "b": profile_id},
    )
    profile = await session.get(Profile, profile_id)
    # Blocked users get the same answer as for a missing profile.
    if profile is None or blocked or (not profile.onboarding_completed and profile_id != viewer_id):
        raise NotFound("Profile")
    images = await _images(session, profile_id, visible_only=True)
    return PublicProfile(
        id=profile.id,
        name=profile.display_name or profile.name,
        bio=profile.bio,
        age=current_age(profile) if profile.show_age is not False else None,
        gender=profile.gender,
        relationship_goal=profile.relationship_goal,
        height_cm=profile.height_cm,
        occupation=profile.occupation,
        education=profile.education,
        city=profile.city,
        country=profile.country,
        pronouns=profile.pronouns,
        interests=profile.interests or [],
        verified=bool(profile.verified),
        images=[i.url for i in images],
    )


async def create_image_upload(
    storage: StorageProvider, bucket: str, session: AsyncSession, user_id: uuid.UUID, content_type: str
) -> SignedUpload:
    count = await session.scalar(
        select(func.count()).select_from(ProfileImage).where(ProfileImage.profile_id == user_id)
    )
    if (count or 0) >= MAX_IMAGES:
        raise AppError(409, f"You can have at most {MAX_IMAGES} photos", code="too_many_images")
    path = f"{user_id}/{uuid.uuid4()}.{EXTENSIONS[content_type]}"
    try:
        return await storage.create_signed_upload(bucket, path)
    except StorageError as exc:
        raise _storage_unavailable(exc) from exc


async def register_image(
    storage: StorageProvider, bucket: str, session: AsyncSession, user_id: uuid.UUID, path: str
) -> ImageOut:
    owner, _, name = path.partition("/")
    if owner != str(user_id) or not name or "/" in name or ".." in path:
        raise AppError(403, "You can only add photos you uploaded", code="forbidden_path")
    try:
        if not await storage.exists(bucket, path):
            raise AppError(422, "The uploaded file was not found; upload it again", code="upload_missing")
        url = storage.public_url(bucket, path)
    except StorageError as exc:
        raise _storage_unavailable(exc) from exc

    # Serialise concurrent registrations for the same user so the photo limit holds.
    await session.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:k, 0))"), {"k": f"images:{user_id}"})
    count = await session.scalar(
        select(func.count()).select_from(ProfileImage).where(ProfileImage.profile_id == user_id)
    )
    if (count or 0) >= MAX_IMAGES:
        raise AppError(409, f"You can have at most {MAX_IMAGES} photos", code="too_many_images")
    position = await session.scalar(
        select(func.coalesce(func.max(ProfileImage.position) + 1, 0)).where(ProfileImage.profile_id == user_id)
    )
    image = ProfileImage(profile_id=user_id, url=url, position=position, is_visible=True)
    session.add(image)
    if position == 0:
        await session.execute(update(Profile).where(Profile.id == user_id).values(avatar_url=url))
    await session.commit()
    await session.refresh(image)
    return ImageOut(id=image.id, url=image.url, position=image.position or 0, is_visible=True)


async def _own_image(session: AsyncSession, user_id: uuid.UUID, image_id: uuid.UUID) -> ProfileImage:
    image = await session.get(ProfileImage, image_id)
    if image is None or image.profile_id != user_id:
        raise NotFound("Photo")
    return image


async def set_image_visibility(
    session: AsyncSession, user_id: uuid.UUID, image_id: uuid.UUID, is_visible: bool
) -> ImageOut:
    image = await _own_image(session, user_id, image_id)
    image.is_visible = is_visible
    await session.commit()
    return ImageOut(id=image.id, url=image.url, position=image.position or 0, is_visible=is_visible)


async def reorder_images(session: AsyncSession, user_id: uuid.UUID, image_ids: list[uuid.UUID]) -> list[ImageOut]:
    current = await _images(session, user_id, visible_only=False)
    if sorted(i.id for i in current) != sorted(image_ids):
        raise AppError(422, "The new order must list each of your photos exactly once", code="invalid_order")
    by_id = {i.id: i for i in current}
    for position, image_id in enumerate(image_ids):
        by_id[image_id].position = position
    first = by_id[image_ids[0]]
    await session.execute(update(Profile).where(Profile.id == user_id).values(avatar_url=first.url))
    await session.commit()
    return [
        ImageOut(id=i, url=by_id[i].url, position=n, is_visible=by_id[i].is_visible is not False)
        for n, i in enumerate(image_ids)
    ]


async def delete_image(
    storage: StorageProvider, bucket: str, session: AsyncSession, user_id: uuid.UUID, image_id: uuid.UUID
) -> None:
    image = await _own_image(session, user_id, image_id)
    path = storage.path_from_public_url(bucket, image.url)
    # Remove the stored file first: if that fails the photo stays listed rather than leaving an orphaned file.
    if path is not None:
        try:
            await storage.delete(bucket, [path])
        except StorageError as exc:
            raise _storage_unavailable(exc) from exc
    await session.delete(image)
    await session.flush()
    remaining = await _images(session, user_id, visible_only=False)
    for position, img in enumerate(remaining):
        img.position = position
    await session.execute(
        update(Profile).where(Profile.id == user_id).values(avatar_url=remaining[0].url if remaining else None)
    )
    await session.commit()


LOCATION_DECIMALS = 2  # about 1 km; exact positions are never stored


async def set_location(session: AsyncSession, user_id: uuid.UUID, latitude: float, longitude: float) -> None:
    await session.execute(
        update(Profile)
        .where(Profile.id == user_id)
        .values(
            latitude=round(latitude, LOCATION_DECIMALS),
            longitude=round(longitude, LOCATION_DECIMALS),
            location_updated_at=func.now(),
        )
    )
    await session.commit()


async def clear_location(session: AsyncSession, user_id: uuid.UUID) -> None:
    await session.execute(
        update(Profile).where(Profile.id == user_id).values(latitude=None, longitude=None, location_updated_at=None)
    )
    await session.commit()
