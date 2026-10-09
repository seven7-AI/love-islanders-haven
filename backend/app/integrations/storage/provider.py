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


class StorageProvider(Protocol):
    async def create_signed_upload(self, bucket: str, path: str) -> SignedUpload: ...

    async def exists(self, bucket: str, path: str) -> bool: ...

    async def delete(self, bucket: str, paths: list[str]) -> None: ...

    def public_url(self, bucket: str, path: str) -> str: ...

    def path_from_public_url(self, bucket: str, url: str) -> str | None: ...


class UnconfiguredStorage:
    """Used when no storage credentials are set: every operation fails explicitly instead of pretending."""

    async def create_signed_upload(self, bucket: str, path: str) -> SignedUpload:
        raise StorageNotConfigured("Image storage is not configured")

    async def exists(self, bucket: str, path: str) -> bool:
        raise StorageNotConfigured("Image storage is not configured")

    async def delete(self, bucket: str, paths: list[str]) -> None:
        raise StorageNotConfigured("Image storage is not configured")

    def public_url(self, bucket: str, path: str) -> str:
        raise StorageNotConfigured("Image storage is not configured")

    def path_from_public_url(self, bucket: str, url: str) -> str | None:
        return None
