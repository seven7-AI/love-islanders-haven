"""Pexels photos for the seed, downloaded once into a git-ignored cache so re-runs do not use the Pexels quota."""

import json
from pathlib import Path

from app.integrations.pexels import ImageSize, PexelsClient

CACHE_DIR = Path(__file__).resolve().parents[1] / ".seed-cache"


class PhotoSource:
    def __init__(self, api_key: str | None, cache_dir: Path = CACHE_DIR) -> None:
        self._api_key = api_key
        self._cache = cache_dir
        self._client: PexelsClient | None = None

    async def aclose(self) -> None:
        if self._client:
            await self._client.aclose()

    async def get(self, photo_id: int, size: ImageSize) -> tuple[bytes, str]:
        """Image bytes and content type, from the cache or (first time only) from Pexels."""
        image = self._cache / f"{photo_id}-{size}.img"
        meta = self._cache / f"{photo_id}-{size}.json"
        if image.exists() and meta.exists():
            return image.read_bytes(), json.loads(meta.read_text())["content_type"]
        if not self._api_key:
            raise RuntimeError(f"Photo {photo_id} is not cached and PEXELS_API_KEY is not set")
        if self._client is None:
            self._client = PexelsClient(self._api_key)
        photo = await self._client.get_photo(photo_id)
        data, content_type = await self._client.download(photo, size)
        self._cache.mkdir(parents=True, exist_ok=True)
        image.write_bytes(data)
        meta.write_text(
            json.dumps(
                {
                    "content_type": content_type,
                    "photographer": photo.photographer,
                    "photographer_url": photo.photographer_url,
                    "page_url": photo.page_url,
                }
            )
        )
        return data, content_type
