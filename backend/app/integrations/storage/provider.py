from dataclasses import dataclass
from typing import Protocol


class StorageError(Exception):
    """The storage service failed or rejected the request."""


class StorageNotConfigured(StorageError):
    """No storage backend is configured for this deployment."""


@dataclass(frozen=True)
class SignedUpload:
    """Where and how the browser uploads a file directly to storage."""

    bucket: str
    path: str
    token: str
    url: str


@dataclass(frozen=True)
class StoredObject:
    """What Storage holds at a path: its size, the content type it was uploaded with, and its first bytes."""

    size: int
    content_type: str
    head: bytes


class StorageProvider(Protocol):
    async def create_signed_upload(self, bucket: str, path: str) -> SignedUpload: ...

    async def inspect(self, bucket: str, path: str) -> StoredObject | None:
        """The stored object at `path`, or None if there is none."""
        ...

    async def delete(self, bucket: str, paths: list[str]) -> None: ...

    def public_url(self, bucket: str, path: str) -> str: ...

    async def signed_download_url(self, bucket: str, path: str, expires_in: int) -> str: ...

    def path_from_public_url(self, bucket: str, url: str) -> str | None: ...


class UnconfiguredStorage:
    """Used when no storage credentials are set: every operation fails explicitly instead of pretending."""

    async def create_signed_upload(self, bucket: str, path: str) -> SignedUpload:
        raise StorageNotConfigured("Image storage is not configured")

    async def inspect(self, bucket: str, path: str) -> StoredObject | None:
        raise StorageNotConfigured("Image storage is not configured")

    async def delete(self, bucket: str, paths: list[str]) -> None:
        raise StorageNotConfigured("Image storage is not configured")

    def public_url(self, bucket: str, path: str) -> str:
        raise StorageNotConfigured("Image storage is not configured")

    async def signed_download_url(self, bucket: str, path: str, expires_in: int) -> str:
        raise StorageNotConfigured("Image storage is not configured")

    def path_from_public_url(self, bucket: str, url: str) -> str | None:
        return None
