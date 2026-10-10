import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request

from app.api.deps import CurrentUser, SessionDep
from app.api.profiles import StorageDep
from app.core.rate_limit import limited
from app.schemas.messages import MediaUploadRequest, MessageCreate, MessageOut, MessagePage, ReadReceipt
from app.schemas.profile import UploadTicket
from app.services import messaging

router = APIRouter(prefix="/v1/matches/{match_id}", tags=["messages"])


def get_chat_bucket(request: Request) -> str:
    return str(request.app.state.settings.chat_media_bucket)


ChatBucket = Annotated[str, Depends(get_chat_bucket)]


@router.get("/messages")
async def list_messages(
    match_id: uuid.UUID,
    user: CurrentUser,
    session: SessionDep,
    storage: StorageDep,
    bucket: ChatBucket,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
    before: str | None = None,
    after: datetime | None = None,
) -> MessagePage:
    return await messaging.list_messages(
        session, storage, bucket, user.id, match_id, limit=limit, before=before, after=after
    )


@router.get("/messages/{message_id}")
async def get_message(
    match_id: uuid.UUID,
    message_id: uuid.UUID,
    user: CurrentUser,
    session: SessionDep,
    storage: StorageDep,
    bucket: ChatBucket,
) -> MessageOut:
    """One message, with a new signed `media_url`; used when a previously signed URL has expired."""
    return await messaging.get_message(session, storage, bucket, user.id, match_id, message_id)


@router.post("/messages", status_code=201, dependencies=limited("messages", 60))
async def send_message(
    match_id: uuid.UUID,
    body: MessageCreate,
    user: CurrentUser,
    session: SessionDep,
    storage: StorageDep,
    bucket: ChatBucket,
) -> MessageOut:
    return await messaging.send_message(session, storage, bucket, user.id, match_id, body)


@router.post("/media/uploads", status_code=201, dependencies=limited("uploads", 30))
async def request_media_upload(
    match_id: uuid.UUID,
    body: MediaUploadRequest,
    user: CurrentUser,
    session: SessionDep,
    storage: StorageDep,
    bucket: ChatBucket,
) -> UploadTicket:
    signed = await messaging.create_media_upload(session, storage, bucket, user.id, match_id, body.content_type)
    return UploadTicket(bucket=signed.bucket, path=signed.path, token=signed.token, upload_url=signed.url)


@router.post("/read")
async def mark_read(match_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> ReadReceipt:
    return ReadReceipt(marked_read=await messaging.mark_read(session, user.id, match_id))
