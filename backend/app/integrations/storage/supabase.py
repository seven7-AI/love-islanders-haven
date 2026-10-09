"""Supabase Storage over its REST API, authenticated with the service role key (server-side only)."""

from urllib.parse import parse_qs, quote, unquote, urlparse

import httpx

from app.integrations.storage.provider import SignedUpload, StorageError


class SupabaseStorage:
    def __init__(self, supabase_url: str, service_role_key: str, client: httpx.AsyncClient | None = None) -> None:
        self._base = f"{supabase_url.rstrip('/')}/storage/v1"
        self._headers = {"apikey": service_role_key, "Authorization": f"Bearer {service_role_key}"}
        self._client = client or httpx.AsyncClient(timeout=10)

    @staticmethod
    def _object(bucket: str, path: str) -> str:
        return f"{quote(bucket)}/{quote(path)}"

    async def create_signed_upload(self, bucket: str, path: str) -> SignedUpload:
        response = await self._client.post(
            f"{self._base}/object/upload/sign/{self._object(bucket, path)}", headers=self._headers
        )
        if response.status_code != 200:
            raise StorageError(f"Signed upload URL request failed ({response.status_code})")
        relative = response.json().get("url", "")
        token = parse_qs(urlparse(relative).query).get("token", [""])[0]
        if not token:
            raise StorageError("Storage did not return an upload token")
        return SignedUpload(bucket=bucket, path=path, token=token, url=f"{self._base}{relative}")

    async def exists(self, bucket: str, path: str) -> bool:
        response = await self._client.get(
            f"{self._base}/object/info/{self._object(bucket, path)}", headers=self._headers
        )
        if response.status_code == 200:
            return True
        if response.status_code in (400, 404):
            return False
        raise StorageError(f"Storage lookup failed ({response.status_code})")

    async def delete(self, bucket: str, paths: list[str]) -> None:
        response = await self._client.request(
            "DELETE", f"{self._base}/object/{quote(bucket)}", headers=self._headers, json={"prefixes": paths}
        )
        if response.status_code != 200:
            raise StorageError(f"Storage delete failed ({response.status_code})")

    def public_url(self, bucket: str, path: str) -> str:
        return f"{self._base}/object/public/{self._object(bucket, path)}"

    async def signed_download_url(self, bucket: str, path: str, expires_in: int) -> str:
        response = await self._client.post(
            f"{self._base}/object/sign/{self._object(bucket, path)}",
            headers=self._headers,
            json={"expiresIn": expires_in},
        )
        if response.status_code != 200:
            raise StorageError(f"Signed download URL request failed ({response.status_code})")
        relative = response.json().get("signedURL", "")
        if not relative:
            raise StorageError("Storage did not return a signed URL")
        return f"{self._base}{relative}"

    def path_from_public_url(self, bucket: str, url: str) -> str | None:
        prefix = f"{self._base}/object/public/{quote(bucket)}/"
        return unquote(url[len(prefix) :]) if url.startswith(prefix) else None
