import uuid
from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, SessionDep
from app.api.profiles import BucketDep, StorageDep
from app.schemas.profile import UploadRequest, UploadTicket
from app.schemas.streaks import LeaderboardEntry, LikeState, StreakCreate, StreakFeed, StreakPost, StreakStatus
from app.services import streaks

router = APIRouter(prefix="/v1/streaks", tags=["streaks"])


@router.get("")
async def feed(
    user: CurrentUser, session: SessionDep, limit: Annotated[int, Query(ge=1, le=50)] = 20, cursor: str | None = None
) -> StreakFeed:
    return await streaks.feed(session, user.id, limit, cursor)


@router.post("/uploads", status_code=201)
async def request_upload(
    body: UploadRequest, user: CurrentUser, storage: StorageDep, bucket: BucketDep
) -> UploadTicket:
    signed = await streaks.create_upload(storage, bucket, user.id, body.content_type)
    return UploadTicket(bucket=signed.bucket, path=signed.path, token=signed.token, upload_url=signed.url)


@router.post("", status_code=201)
async def create(
    body: StreakCreate, user: CurrentUser, session: SessionDep, storage: StorageDep, bucket: BucketDep
) -> StreakPost:
    return await streaks.create_post(session, storage, bucket, user.id, body)


@router.get("/me")
async def my_status(user: CurrentUser, session: SessionDep) -> StreakStatus:
    return await streaks.status(session, user.id)


@router.get("/leaderboard")
async def leaderboard(
    user: CurrentUser, session: SessionDep, limit: Annotated[int, Query(ge=1, le=20)] = 3
) -> list[LeaderboardEntry]:
    return await streaks.leaderboard(session, user.id, limit)


@router.put("/{post_id}/like")
async def like(post_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> LikeState:
    return await streaks.set_like(session, user.id, post_id, liked=True)


@router.delete("/{post_id}/like")
async def unlike(post_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> LikeState:
    return await streaks.set_like(session, user.id, post_id, liked=False)
