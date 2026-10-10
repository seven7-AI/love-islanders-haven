"""Pexels photos for the seed, downloaded once into a git-ignored cache so re-runs do not use the Pexels quota.

Where no Pexels key is available (CI without the secret), `placeholders=True` substitutes a generated plain-colour
PNG for each photo instead. They go through the same upload flow and checks; they are not stock photos and the log
says so. The README screenshots must not be taken with them.
"""

import json
import struct
import zlib
from pathlib import Path

from app.integrations.pexels import ImageSize, PexelsClient

CACHE_DIR = Path(__file__).resolve().parents[1] / ".seed-cache"


def _png_chunk(kind: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)


def placeholder_png(photo_id: int, width: int = 300, height: int = 400) -> bytes:
    """A plain PNG whose colour is derived from the photo id (deterministic, no external service)."""
    colour = bytes(((photo_id >> shift) & 0x7F) + 64 for shift in (0, 7, 14))
    row = b"\x00" + colour * width
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + _png_chunk(b"IHDR", header)
        + _png_chunk(b"IDAT", zlib.compress(row * height))
        + _png_chunk(b"IEND", b"")
    )


class PhotoSource:
    def __init__(self, api_key: str | None, cache_dir: Path = CACHE_DIR, *, placeholders: bool = False) -> None:
        self._api_key = api_key
        self._cache = cache_dir
        self._placeholders = placeholders
        self._client: PexelsClient | None = None
        self.placeholders_used = 0

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
            if self._placeholders:
                self.placeholders_used += 1
                return placeholder_png(photo_id), "image/png"
            raise RuntimeError(
                f"Photo {photo_id} is not cached and PEXELS_API_KEY is not set "
                "(SEED_PLACEHOLDER_PHOTOS=true uses generated placeholder images instead)"
            )
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
