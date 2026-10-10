"""HTTP access to the stack the seed runs against: Supabase Auth (admin + password sign-in) and the Love Islander API.

Everything the seed creates goes through these real endpoints, so the API's validation and rules apply.
"""

import asyncio
from dataclasses import dataclass
from typing import Any

import httpx


class SeedError(Exception):
    pass


@dataclass
class Session:
    user_id: str
    token: str


class Stack:
    def __init__(self, api_url: str, supabase_url: str, anon_key: str, service_role_key: str) -> None:
        self.api_url = api_url.rstrip("/")
        self.supabase_url = supabase_url.rstrip("/")
        self._anon = {"apikey": anon_key}
        self._admin = {"apikey": service_role_key, "Authorization": f"Bearer {service_role_key}"}
        self.http = httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=5.0))

    async def aclose(self) -> None:
        await self.http.aclose()

    async def _send(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        """Sends a request, waiting out the API's rate limits (429 + Retry-After) instead of failing."""
        for _ in range(20):
            response = await self.http.request(method, url, **kwargs)
            if response.status_code != 429:
                return response
            await asyncio.sleep(min(float(response.headers.get("Retry-After", "5")), 60.0))
        raise SeedError(f"{method} {url}: still rate limited")

    # Supabase Auth -------------------------------------------------------------------------------------------------

    async def auth_users(self) -> list[dict[str, Any]]:
        users: list[dict[str, Any]] = []
        page = 1
        while True:
            response = await self._send(
                "GET",
                f"{self.supabase_url}/auth/v1/admin/users",
                params={"page": page, "per_page": 200},
                headers=self._admin,
            )
            _check(response, "list auth users")
            batch = response.json().get("users", [])
            users.extend(batch)
            if len(batch) < 200:
                return users
            page += 1

    async def ensure_auth_user(self, email: str, password: str, name: str) -> str:
        """Creates a confirmed user, or resets the password of the existing one. Returns the user id."""
        response = await self._send(
            "POST",
            f"{self.supabase_url}/auth/v1/admin/users",
            headers=self._admin,
            json={"email": email, "password": password, "email_confirm": True, "user_metadata": {"name": name}},
        )
        if response.status_code in (200, 201):
            return str(response.json()["id"])
        existing = next((u for u in await self.auth_users() if u.get("email") == email), None)
        if existing is None:
            _check(response, f"create auth user {email}")
            raise SeedError(f"create auth user {email}")  # pragma: no cover
        update = await self._send(
            "PUT",
            f"{self.supabase_url}/auth/v1/admin/users/{existing['id']}",
            headers=self._admin,
            json={"password": password, "email_confirm": True},
        )
        _check(update, f"update auth user {email}")
        return str(existing["id"])

    async def delete_auth_user(self, user_id: str) -> None:
        response = await self._send("DELETE", f"{self.supabase_url}/auth/v1/admin/users/{user_id}", headers=self._admin)
        if response.status_code not in (200, 204, 404):
            _check(response, f"delete auth user {user_id}")

    async def sign_in(self, email: str, password: str) -> Session:
        response = await self._send(
            "POST",
            f"{self.supabase_url}/auth/v1/token",
            params={"grant_type": "password"},
            headers=self._anon,
            json={"email": email, "password": password},
        )
        _check(response, f"sign in {email}")
        body = response.json()
        return Session(user_id=str(body["user"]["id"]), token=str(body["access_token"]))

    # Storage (service role; used only by reset) -------------------------------------------------------------------

    async def list_objects(self, bucket: str, prefix: str) -> list[str]:
        """All object paths under a prefix (recursing into folders)."""
        response = await self._send(
            "POST",
            f"{self.supabase_url}/storage/v1/object/list/{bucket}",
            headers=self._admin,
            json={"prefix": prefix, "limit": 1000},
        )
        if response.status_code == 404:
            return []
        _check(response, f"list {bucket}/{prefix}")
        paths: list[str] = []
        for item in response.json():
            path = f"{prefix.rstrip('/')}/{item['name']}"
            paths.extend([path] if item.get("id") else await self.list_objects(bucket, path))
        return paths

    async def delete_objects(self, bucket: str, paths: list[str]) -> None:
        if not paths:
            return
        response = await self._send(
            "DELETE", f"{self.supabase_url}/storage/v1/object/{bucket}", headers=self._admin, json={"prefixes": paths}
        )
        _check(response, f"delete objects in {bucket}")

    # Love Islander API --------------------------------------------------------------------------------------------

    async def api(
        self, session: Session, method: str, path: str, body: Any = None, *, ok: tuple[int, ...] = (200, 201, 204)
    ) -> Any:
        response = await self._send(
            method,
            f"{self.api_url}{path}",
            headers={"Authorization": f"Bearer {session.token}"},
            json=body,
        )
        if response.status_code not in ok:
            _check(response, f"{method} {path}")
        if response.status_code == 204 or not response.content:
            return None
        return response.json()

    async def upload(
        self, session: Session, ticket_path: str, body: dict[str, Any], data: bytes, content_type: str
    ) -> str:
        """Requests a signed upload ticket from the API, uploads the bytes to Storage with it, returns the path."""
        ticket = await self.api(session, "POST", ticket_path, body)
        response = await self._send("PUT", ticket["upload_url"], content=data, headers={"Content-Type": content_type})
        _check(response, f"upload {ticket['path']}")
        return str(ticket["path"])


def _check(response: httpx.Response, what: str) -> None:
    if response.status_code >= 400:
        detail = response.text[:300]
        raise SeedError(f"{what} failed ({response.status_code}): {detail}")
