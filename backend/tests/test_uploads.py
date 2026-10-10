"""File-type recognition and the stored-upload check, against the in-memory storage fake."""

import pytest

from app.core.errors import AppError
from app.services.uploads import IMAGE_EXTENSIONS, MEDIA_EXTENSIONS, sniff, verify_upload
from tests.fakes import FakeStorage


@pytest.mark.parametrize(
    ("head", "media_type"),
    [
        (b"\xff\xd8\xff\xe0\x00\x10JFIF", "image/jpeg"),
        (b"\x89PNG\r\n\x1a\n\x00\x00", "image/png"),
        (b"RIFF\x24\x00\x00\x00WEBPVP8 ", "image/webp"),
        (b"\x1a\x45\xdf\xa3\x9f\x42\x86\x81", "audio/webm"),
        (b"OggS\x00\x02\x00\x00", "audio/ogg"),
        (b"ID3\x04\x00\x00\x00\x00", "audio/mpeg"),
        (b"\xff\xfb\x90\x64\x00\x00", "audio/mpeg"),
        (b"\x00\x00\x00\x20ftypM4A ", "audio/mp4"),
        (b"GIF89a\x01\x00", None),
        (b"<svg xmlns=", None),
        (b"", None),
    ],
)
def test_sniff(head: bytes, media_type: str | None) -> None:
    assert sniff(head) == media_type


async def test_accepts_matching_file() -> None:
    storage = FakeStorage()
    storage.put("b", "u/a.jpg")
    await verify_upload(storage, "b", "u/a.jpg", allowed=IMAGE_EXTENSIONS, max_bytes=100)
    assert ("b", "u/a.jpg") in storage.objects


async def test_audio_with_codec_parameters_is_accepted() -> None:
    storage = FakeStorage()
    storage.put("b", "m/u/a.webm", data=b"\x1a\x45\xdf\xa3" + b"\x00" * 12, content_type="audio/webm;codecs=opus")
    await verify_upload(storage, "b", "m/u/a.webm", allowed=MEDIA_EXTENSIONS, max_bytes=100)


async def test_audio_is_not_a_profile_photo() -> None:
    storage = FakeStorage()
    storage.put("b", "u/a.webm", data=b"\x1a\x45\xdf\xa3" + b"\x00" * 12, content_type="audio/webm")
    with pytest.raises(AppError) as error:
        await verify_upload(storage, "b", "u/a.webm", allowed=IMAGE_EXTENSIONS, max_bytes=100)
    assert error.value.code == "upload_invalid_type"
    assert not storage.objects


async def test_extension_must_match_contents() -> None:
    storage = FakeStorage()
    storage.put("b", "u/a.png")  # JPEG bytes and type under a .png name
    with pytest.raises(AppError) as error:
        await verify_upload(storage, "b", "u/a.png", allowed=IMAGE_EXTENSIONS, max_bytes=100)
    assert error.value.code == "upload_invalid_type"


async def test_rejection_stands_when_the_delete_fails() -> None:
    storage = FakeStorage()
    storage.put("b", "u/a.jpg", size=101)
    storage.fail_deletes = True
    with pytest.raises(AppError) as error:
        await verify_upload(storage, "b", "u/a.jpg", allowed=IMAGE_EXTENSIONS, max_bytes=100)
    assert error.value.code == "upload_too_large"
