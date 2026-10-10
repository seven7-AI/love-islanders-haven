"""Pexels API client (https://www.pexels.com/api/documentation/), server-side only.

Used by the local seed tool to fetch stock photos; the running API never calls Pexels. The API key is sent only in
the Authorization header to api.pexels.com and never appears in errors or logs. Image files are downloaded from the
public `src` URLs, which need no key.
"""

import asyncio
from dataclasses import dataclass, field
from types import TracebackType
from typing import Any, Literal, Self

import httpx

API_BASE = "https://api.pexels.com/v1"
ImageSize = Literal["original", "large2x", "large", "medium", "small", "portrait", "landscape", "tiny"]
_MAX_WAIT_SECONDS = 60.0


class PexelsError(Exception):
    """A Pexels request failed. Messages never include the API key."""


class PexelsRateLimited(PexelsError):
    pass


@dataclass(frozen=True)
class PexelsPhoto:
    id: int
    width: int
    height: int
    alt: str
    photographer: str
    photographer_url: str
    page_url: str
    src: dict[str, str] = field(default_factory=dict)

    @classmethod
    def from_api(cls, data: dict[str, Any]) -> "PexelsPhoto":
        return cls(
            id=int(data["id"]),
            width=int(data.get("width") or 0),
            height=int(data.get("height") or 0),
            alt=str(data.get("alt") or ""),
            photographer=str(data.get("photographer") or ""),
            photographer_url=str(data.get("photographer_url") or ""),
            page_url=str(data.get("url") or ""),
            src={str(k): str(v) for k, v in (data.get("src") or {}).items()},
        )


class PexelsClient:
    """Async client with timeouts, bounded retries for 429/5xx/network errors, and rate-limit tracking."""

    def __init__(
        self,
        api_key: str,
        *,
        client: httpx.AsyncClient | None = None,
        max_retries: int = 3,
        backoff_seconds: float = 1.0,
    ) -> None:
        if not api_key:
            raise PexelsError("Pexels API key is not configured (set PEXELS_API_KEY)")
        self._headers = {"Authorization": api_key}
        self._client = client or httpx.AsyncClient(timeout=httpx.Timeout(15.0, connect=5.0))
        self._max_retries = max_retries
        self._backoff = backoff_seconds
        #: Requests left in the current Pexels quota period, from the last API response (None until known).
        self.rate_limit_remaining: int | None = None

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(
        self, exc_type: type[BaseException] | None, exc: BaseException | None, tb: TracebackType | None
    ) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _request(self, url: str, *, params: dict[str, Any] | None = None, api: bool = True) -> httpx.Response:
        for attempt in range(self._max_retries + 1):
            last = attempt == self._max_retries
            try:
                response = await self._client.get(url, params=params, headers=self._headers if api else None)
            except httpx.TransportError as exc:
                if last:
                    raise PexelsError(f"Pexels request failed: {type(exc).__name__}") from None
                await asyncio.sleep(self._backoff * 2**attempt)
                continue
            if api and (remaining := response.headers.get("X-Ratelimit-Remaining")) is not None:
                self.rate_limit_remaining = int(remaining)
            if response.status_code == 429:
                if last:
                    raise PexelsRateLimited("Pexels rate limit reached; try again later")
                await asyncio.sleep(min(_retry_after(response, self._backoff * 2**attempt), _MAX_WAIT_SECONDS))
                continue
            if response.status_code >= 500 and not last:
                await asyncio.sleep(self._backoff * 2**attempt)
                continue
            if response.status_code == 401:
                raise PexelsError("Pexels rejected the API key (401)")
            if response.status_code != 200:
                raise PexelsError(f"Pexels request failed ({response.status_code})")
            return response
        raise PexelsError("Pexels request failed")  # pragma: no cover - the loop always returns or raises

    async def get_photo(self, photo_id: int) -> PexelsPhoto:
        response = await self._request(f"{API_BASE}/photos/{int(photo_id)}")
        return PexelsPhoto.from_api(response.json())

    async def search(
        self,
        query: str,
        *,
        per_page: int = 15,
        page: int = 1,
        orientation: Literal["landscape", "portrait", "square"] | None = None,
    ) -> list[PexelsPhoto]:
        params: dict[str, Any] = {"query": query, "per_page": min(max(per_page, 1), 80), "page": max(page, 1)}
        if orientation:
            params["orientation"] = orientation
        response = await self._request(f"{API_BASE}/search", params=params)
        return [PexelsPhoto.from_api(p) for p in response.json().get("photos", [])]

    async def download(self, photo: PexelsPhoto, size: ImageSize = "large") -> tuple[bytes, str]:
        """Image bytes and content type of one size variant of the photo."""
        url = photo.src.get(size) or photo.src.get("original")
        if not url:
            raise PexelsError(f"Photo {photo.id} has no downloadable image")
        response = await self._request(url, api=False)
        content_type = response.headers.get("Content-Type", "").split(";")[0].strip()
        if not content_type.startswith("image/"):
            raise PexelsError(f"Photo {photo.id} download returned {content_type or 'no content type'}")
        return response.content, content_type


def _retry_after(response: httpx.Response, default: float) -> float:
    try:
        return max(float(response.headers.get("Retry-After", "")), 0.0)
    except ValueError:
        return default
