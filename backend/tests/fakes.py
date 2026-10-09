"""In-memory stand-ins for external services, used only in tests (they do not verify the real services)."""

from app.integrations.storage import SignedUpload, StorageError

BASE = "https://storage.test/object/public"


class FakeStorage:
    def __init__(self) -> None:
        self.objects: set[tuple[str, str]] = set()
        self.fail_deletes = False

    async def create_signed_upload(self, bucket: str, path: str) -> SignedUpload:
        return SignedUpload(bucket=bucket, path=path, token="tok", url=f"https://storage.test/upload/{bucket}/{path}")

    def put(self, bucket: str, path: str) -> None:
        """Simulates the browser completing the signed upload."""
        self.objects.add((bucket, path))

    async def exists(self, bucket: str, path: str) -> bool:
        return (bucket, path) in self.objects

    async def delete(self, bucket: str, paths: list[str]) -> None:
        if self.fail_deletes:
            raise StorageError("delete failed")
        for path in paths:
            self.objects.discard((bucket, path))

    def public_url(self, bucket: str, path: str) -> str:
        return f"{BASE}/{bucket}/{path}"

    async def signed_download_url(self, bucket: str, path: str, expires_in: int) -> str:
        return f"https://storage.test/signed/{bucket}/{path}?expires={expires_in}"

    def path_from_public_url(self, bucket: str, url: str) -> str | None:
        prefix = f"{BASE}/{bucket}/"
        return url[len(prefix) :] if url.startswith(prefix) else None
