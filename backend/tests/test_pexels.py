"""Pexels client behaviour against a mocked transport (not the real service), and how the key is configured."""

from collections.abc import Callable

import httpx
import pytest

from app.core.config import Settings
from app.integrations.pexels import PexelsClient, PexelsError, PexelsPhoto, PexelsRateLimited

KEY = "pexels-test-key"
PHOTO = {
    "id": 101,
    "width": 3000,
    "height": 4000,
    "url": "https://www.pexels.com/photo/101/",
    "photographer": "Ana",
    "photographer_url": "https://www.pexels.com/@ana",
    "alt": "Woman smiling",
    "src": {"large": "https://images.pexels.com/photos/101/large.jpeg", "original": "https://images.pexels.com/o.jpeg"},
}


def client(handler: Callable[[httpx.Request], httpx.Response], **kwargs: object) -> PexelsClient:
    return PexelsClient(
        KEY,
        client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        backoff_seconds=0,
        **kwargs,  # type: ignore[arg-type]
    )


async def test_get_photo_sends_the_key_and_tracks_the_quota() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url == httpx.URL("https://api.pexels.com/v1/photos/101")
        assert request.headers["Authorization"] == KEY
        return httpx.Response(200, json=PHOTO, headers={"X-Ratelimit-Remaining": "199"})

    pexels = client(handler)
    photo = await pexels.get_photo(101)
    assert photo == PexelsPhoto.from_api(PHOTO)
    assert photo.photographer == "Ana"
    assert pexels.rate_limit_remaining == 199


async def test_search_parameters() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/search"
        assert dict(request.url.params) == {
            "query": "portrait",
            "per_page": "80",
            "page": "1",
            "orientation": "portrait",
        }
        return httpx.Response(200, json={"photos": [PHOTO, {**PHOTO, "id": 102}]})

    photos = await client(handler).search("portrait", per_page=500, orientation="portrait")
    assert [p.id for p in photos] == [101, 102]


async def test_download_does_not_send_the_key_and_checks_the_type() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert "Authorization" not in request.headers
        if request.url.path.endswith("large.jpeg"):
            return httpx.Response(200, content=b"\xff\xd8jpeg", headers={"Content-Type": "image/jpeg"})
        return httpx.Response(200, content=b"<html>", headers={"Content-Type": "text/html"})

    pexels = client(handler)
    data, content_type = await pexels.download(PexelsPhoto.from_api(PHOTO), "large")
    assert (data, content_type) == (b"\xff\xd8jpeg", "image/jpeg")
    with pytest.raises(PexelsError, match="text/html"):
        await pexels.download(PexelsPhoto.from_api({**PHOTO, "src": {"original": "https://images.pexels.com/x"}}))


async def test_retries_rate_limits_then_gives_up() -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if calls < 3:
            return httpx.Response(429, headers={"Retry-After": "0"})
        return httpx.Response(200, json=PHOTO)

    assert (await client(handler, max_retries=3).get_photo(101)).id == 101
    assert calls == 3

    with pytest.raises(PexelsRateLimited):
        await client(lambda _: httpx.Response(429, headers={"Retry-After": "0"}), max_retries=1).get_photo(101)


async def test_errors_never_contain_the_key() -> None:
    def broken(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("boom", request=request)

    for handler in (lambda _: httpx.Response(401), lambda _: httpx.Response(500), broken):
        with pytest.raises(PexelsError) as excinfo:
            await client(handler, max_retries=1).get_photo(101)
        assert KEY not in str(excinfo.value)
        assert KEY not in repr(excinfo.value)


def test_missing_key_is_rejected() -> None:
    with pytest.raises(PexelsError, match="PEXELS_API_KEY"):
        PexelsClient("")


@pytest.mark.parametrize("name", ["PEXELS_API_KEY", "PEXEL_API_KEY"])
def test_key_is_read_from_either_variable_name_and_masked(name: str, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(name, "from-env")
    settings = Settings(_env_file=None, database_url="postgresql+asyncpg://u:p@localhost/db", supabase_jwt_secret="s")
    assert settings.pexels_api_key is not None
    assert settings.pexels_api_key.get_secret_value() == "from-env"
    assert "from-env" not in repr(settings)
