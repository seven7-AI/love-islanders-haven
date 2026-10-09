"""Google OAuth 2.0 and Calendar API client (server side only)."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from urllib.parse import urlencode

import httpx

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"  # noqa: S105 - public endpoint, not a secret
REVOKE_URL = "https://oauth2.googleapis.com/revoke"
EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
SCOPE = "https://www.googleapis.com/auth/calendar.readonly"


class GoogleError(Exception):
    pass


class GoogleAuthRevoked(GoogleError):
    """The user revoked access at Google; the stored connection is no longer valid."""


@dataclass(frozen=True)
class GoogleEvent:
    id: str
    title: str
    location: str | None
    notes: str | None
    start: str
    end: str | None


class GoogleCalendarClient:
    def __init__(self, client_id: str, client_secret: str, redirect_uri: str, http: httpx.AsyncClient | None = None):
        self._client_id = client_id
        self._client_secret = client_secret
        self.redirect_uri = redirect_uri
        self._http = http or httpx.AsyncClient(timeout=10)

    def authorization_url(self, state: str) -> str:
        params = {
            "client_id": self._client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": SCOPE,
            "access_type": "offline",
            "prompt": "consent",
            "include_granted_scopes": "true",
            "state": state,
        }
        return f"{AUTH_URL}?{urlencode(params)}"

    async def _token(self, data: dict[str, str]) -> dict[str, Any]:
        try:
            response = await self._http.post(
                TOKEN_URL, data={**data, "client_id": self._client_id, "client_secret": self._client_secret}
            )
        except httpx.HTTPError as exc:
            raise GoogleError("Google could not be reached") from exc
        if response.status_code == 400 and response.json().get("error") == "invalid_grant":
            raise GoogleAuthRevoked("Google access was revoked or the code expired")
        if response.status_code != 200:
            raise GoogleError(f"Google token endpoint returned {response.status_code}")
        body: dict[str, Any] = response.json()
        return body

    async def exchange_code(self, code: str) -> tuple[str, str | None]:
        """Returns (refresh_token, scope)."""
        body = await self._token({"code": code, "grant_type": "authorization_code", "redirect_uri": self.redirect_uri})
        refresh = body.get("refresh_token")
        if not refresh:
            raise GoogleError("Google did not return a refresh token")
        return refresh, body.get("scope")

    async def access_token(self, refresh_token: str) -> str:
        body = await self._token({"refresh_token": refresh_token, "grant_type": "refresh_token"})
        token = body.get("access_token")
        if not token:
            raise GoogleError("Google did not return an access token")
        return str(token)

    async def revoke(self, token: str) -> None:
        try:
            await self._http.post(REVOKE_URL, data={"token": token})
        except httpx.HTTPError as exc:
            raise GoogleError("Google could not be reached") from exc

    async def events(self, access_token: str, time_min: datetime, time_max: datetime) -> list[GoogleEvent]:
        try:
            response = await self._http.get(
                EVENTS_URL,
                headers={"Authorization": f"Bearer {access_token}"},
                params={
                    "timeMin": time_min.isoformat(),
                    "timeMax": time_max.isoformat(),
                    "singleEvents": "true",
                    "orderBy": "startTime",
                    "maxResults": "100",
                },
            )
        except httpx.HTTPError as exc:
            raise GoogleError("Google could not be reached") from exc
        if response.status_code != 200:
            raise GoogleError(f"Google Calendar returned {response.status_code}")
        events = []
        for item in response.json().get("items", []):
            start = item.get("start", {})
            end = item.get("end", {})
            events.append(
                GoogleEvent(
                    id=item["id"],
                    title=item.get("summary") or "(no title)",
                    location=item.get("location"),
                    notes=item.get("description"),
                    start=start.get("dateTime") or start.get("date"),
                    end=end.get("dateTime") or end.get("date"),
                )
            )
        return events
