import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response

from app.api.deps import CurrentUser, SessionDep
from app.core.rate_limit import limited
from app.integrations.storage import StorageProvider
from app.schemas.profile import (
    ImageOrder,
    ImageOut,
    ImageRegister,
    ImageUpdate,
    LocationUpdate,
    OnboardingStepUpdate,
    OwnProfile,
    ProfileUpdate,
    PublicProfile,
    UploadRequest,
    UploadTicket,
)
from app.services import profiles

router = APIRouter(prefix="/v1", tags=["profiles"])


def get_storage(request: Request) -> StorageProvider:
    storage: StorageProvider = request.app.state.storage
    return storage


def get_images_bucket(request: Request) -> str:
    return str(request.app.state.settings.profile_images_bucket)


StorageDep = Annotated[StorageProvider, Depends(get_storage)]
BucketDep = Annotated[str, Depends(get_images_bucket)]


@router.get("/me/profile")
async def read_my_profile(user: CurrentUser, session: SessionDep) -> OwnProfile:
    return await profiles.get_own_profile(session, user.id)


@router.patch("/me/profile")
async def update_my_profile(changes: ProfileUpdate, user: CurrentUser, session: SessionDep) -> OwnProfile:
    return await profiles.update_profile(session, user.id, changes)


@router.put("/me/onboarding")
async def update_onboarding(body: OnboardingStepUpdate, user: CurrentUser, session: SessionDep) -> OwnProfile:
    return await profiles.set_onboarding_step(session, user.id, body.step)


@router.get("/profiles/{profile_id}")
async def read_profile(profile_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> PublicProfile:
    return await profiles.get_public_profile(session, user.id, profile_id)


@router.post("/me/images/uploads", status_code=201, dependencies=limited("uploads", 30))
async def request_image_upload(
    body: UploadRequest, user: CurrentUser, session: SessionDep, storage: StorageDep, bucket: BucketDep
) -> UploadTicket:
    signed = await profiles.create_image_upload(storage, bucket, session, user.id, body.content_type)
    return UploadTicket(bucket=signed.bucket, path=signed.path, token=signed.token, upload_url=signed.url)


@router.post("/me/images", status_code=201)
async def add_image(
    body: ImageRegister, user: CurrentUser, session: SessionDep, storage: StorageDep, bucket: BucketDep
) -> ImageOut:
    return await profiles.register_image(storage, bucket, session, user.id, body.path)


@router.patch("/me/images/{image_id}")
async def update_image(image_id: uuid.UUID, body: ImageUpdate, user: CurrentUser, session: SessionDep) -> ImageOut:
    return await profiles.set_image_visibility(session, user.id, image_id, body.is_visible)


@router.put("/me/images/order")
async def reorder_images(body: ImageOrder, user: CurrentUser, session: SessionDep) -> list[ImageOut]:
    return await profiles.reorder_images(session, user.id, body.image_ids)


@router.delete("/me/images/{image_id}", status_code=204)
async def delete_image(
    image_id: uuid.UUID, user: CurrentUser, session: SessionDep, storage: StorageDep, bucket: BucketDep
) -> Response:
    await profiles.delete_image(storage, bucket, session, user.id, image_id)
    return Response(status_code=204)


@router.put("/me/location", status_code=204, dependencies=limited("location", 20))
async def update_location(body: LocationUpdate, user: CurrentUser, session: SessionDep) -> Response:
    await profiles.set_location(session, user.id, body.latitude, body.longitude)
    return Response(status_code=204)


@router.delete("/me/location", status_code=204)
async def clear_location(user: CurrentUser, session: SessionDep) -> Response:
    await profiles.clear_location(session, user.id)
    return Response(status_code=204)
