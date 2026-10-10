"""Request/response handling of the Supabase Storage client, against a mocked transport (not the real service)."""

import json
from collections.abc import Callable

import httpx
import pytest

from app.integrations.storage import StorageError, SupabaseStorage


def client(handler: Callable[[httpx.Request], httpx.Response]) -> SupabaseStorage:
    return SupabaseStorage(
        "https://proj.supabase.co", "service-key", httpx.AsyncClient(transport=httpx.MockTransport(handler))
    )


async def test_signed_upload() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert request.url.path == "/storage/v1/object/upload/sign/profile-images/u1/a.jpg"
        assert request.headers["Authorization"] == "Bearer service-key"
        return httpx.Response(200, json={"url": "/object/upload/sign/profile-images/u1/a.jpg?token=abc"})

    upload = await client(handler).create_signed_upload("profile-images", "u1/a.jpg")
    assert upload.token == "abc"
    assert upload.url == "https://proj.supabase.co/storage/v1/object/upload/sign/profile-images/u1/a.jpg?token=abc"


async def test_inspect_reads_info_and_leading_bytes() -> None:
    """The info response shape and the ranged read match what the local Supabase Storage returns."""

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/no.jpg"):
            return httpx.Response(400, json={"error": "not_found"})
        if request.url.path.startswith("/storage/v1/object/info/b/"):
            return httpx.Response(200, json={"name": "u1/yes.jpg", "size": 1234, "content_type": "image/jpeg"})
        assert request.url.path == "/storage/v1/object/authenticated/b/u1/yes.jpg"
        assert request.headers["Range"] == "bytes=0-15"
        return httpx.Response(206, content=b"\xff\xd8\xff\xe0" + b"\x00" * 12)

    storage = client(handler)
    stored = await storage.inspect("b", "u1/yes.jpg")
    assert stored is not None
    assert (stored.size, stored.content_type, stored.head[:3]) == (1234, "image/jpeg", b"\xff\xd8\xff")
    assert await storage.inspect("b", "u1/no.jpg") is None


async def test_inspect_raises_on_service_errors() -> None:
    storage = client(lambda request: httpx.Response(500))
    with pytest.raises(StorageError):
        await storage.inspect("b", "u1/a.jpg")


async def test_delete_sends_prefixes_and_raises_on_failure() -> None:
    seen: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(json.loads(request.content))
        return httpx.Response(200 if len(seen) == 1 else 500, json=[])

    storage = client(handler)
    await storage.delete("b", ["u1/a.jpg"])
    assert seen[0] == {"prefixes": ["u1/a.jpg"]}
    with pytest.raises(StorageError):
        await storage.delete("b", ["u1/a.jpg"])


def test_public_url_round_trip() -> None:
    storage = client(lambda r: httpx.Response(200))
    url = storage.public_url("profile-images", "u1/a.jpg")
    assert url == "https://proj.supabase.co/storage/v1/object/public/profile-images/u1/a.jpg"
    assert storage.path_from_public_url("profile-images", url) == "u1/a.jpg"
    assert storage.path_from_public_url("profile-images", "https://elsewhere/x.jpg") is None
