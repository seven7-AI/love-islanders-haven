"""Checks on files the browser uploaded directly to Storage, before the API references them.

The browser declares a content type and size when it asks for an upload ticket, but the upload itself goes straight to
Storage. Before a file is attached to a profile, post or message, the API reads what was actually stored: its size,
its declared content type and its first bytes. A file that is too large, or whose bytes are not the type its name and
declared content type say, is deleted and rejected.
"""

from collections.abc import Mapping

from app.core.errors import AppError
from app.integrations.storage import StorageError, StorageNotConfigured, StorageProvider

MiB = 1024 * 1024
MAX_IMAGE_BYTES = 5 * MiB
MAX_MEDIA_BYTES = 10 * MiB
IMAGE_EXTENSIONS = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
MEDIA_EXTENSIONS = {
    **IMAGE_EXTENSIONS,
    "audio/webm": "webm",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/ogg": "ogg",
}


def storage_unavailable(exc: StorageError) -> AppError:
    if isinstance(exc, StorageNotConfigured):
        return AppError(503, "Image storage is not configured", code="storage_not_configured")
    return AppError(502, "The image storage service failed; please try again", code="storage_failed")


def sniff(head: bytes) -> str | None:
    """The media type the leading bytes identify, among the types the app accepts."""
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    if head.startswith(b"\x1a\x45\xdf\xa3"):
        return "audio/webm"
    if head.startswith(b"OggS"):
        return "audio/ogg"
    if head.startswith(b"ID3") or (len(head) > 1 and head[0] == 0xFF and head[1] & 0xE0 == 0xE0):
        return "audio/mpeg"
    if head[4:8] == b"ftyp":
        return "audio/mp4"
    return None


async def verify_upload(
    storage: StorageProvider, bucket: str, path: str, *, allowed: Mapping[str, str], max_bytes: int
) -> None:
    """Raises unless `path` holds a file of an allowed type, within the size limit; rejected files are deleted."""
    try:
        stored = await storage.inspect(bucket, path)
    except StorageError as exc:
        raise storage_unavailable(exc) from exc
    if stored is None:
        raise AppError(422, "The uploaded file was not found; upload it again", code="upload_missing")

    problem: AppError | None = None
    if stored.size > max_bytes:
        problem = AppError(
            422, f"The file is larger than {max_bytes // MiB} MB; upload a smaller one", code="upload_too_large"
        )
    else:
        actual = sniff(stored.head)
        declared = stored.content_type.split(";")[0].strip().lower()
        extension = path.rsplit(".", 1)[-1].lower()
        if actual is None or actual not in allowed or declared != actual or allowed[actual] != extension:
            problem = AppError(422, "The file is not a supported image or audio type", code="upload_invalid_type")
    if problem is not None:
        try:
            await storage.delete(bucket, [path])
        except StorageError:
            pass  # the rejection stands either way; the API never references the file
        raise problem
