import base64
import json
import uuid
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from cryptography.fernet import Fernet
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.config import Settings
from app.core.crypto import InvalidState, StateSigner, TokenCipher
from app.integrations.google import GoogleCalendarClient
from app.main import create_app
from tests.conftest import auth_headers
from tests.test_discovery import person

KEY = Fernet.generate_key().decode()


class FakeGoogle:
    """Mock transport standing in for Google's OAuth and Calendar endpoints (not the real service)."""

    def __init__(self) -> None:
        self.revoked: list[str] = []
        self.refresh_valid = True

    def __call__(self, request: httpx.Request) -> httpx.Response:
        if request.url.path == "/token":
            form = parse_qs(request.content.decode())
            if form["grant_type"] == ["authorization_code"]:
                assert form["redirect_uri"] == ["https://app.test/calendar/callback"]
                return httpx.Response(200, json={"refresh_token": "refresh-secret", "access_token": "a", "scope": "s"})
            if not self.refresh_valid:
                return httpx.Response(400, json={"error": "invalid_grant"})
            return httpx.Response(200, json={"access_token": "access-1"})
        if request.url.path == "/revoke":
            self.revoked.append(parse_qs(request.content.decode())["token"][0])
            return httpx.Response(200)
        if request.url.path.endswith("/events"):
            assert request.headers["Authorization"] == "Bearer access-1"
            return httpx.Response(
                200,
                json={
                    "items": [
                        {
                            "id": "e1",
                            "summary": "Dinner date",
                            "start": {"dateTime": "2026-11-01T19:00:00Z"},
                            "end": {"dateTime": "2026-11-01T21:00:00Z"},
                        },
                        {"id": "e2", "start": {"date": "2026-11-02"}, "end": {"date": "2026-11-03"}},
                    ]
                },
            )
        return httpx.Response(404)


@pytest.fixture
def google() -> FakeGoogle:
    return FakeGoogle()


@pytest.fixture
async def app(settings: Settings, storage, google: FakeGoogle):  # type: ignore[no-untyped-def]
    configured = settings.model_copy(
        update={
            "google_client_id": "cid",
            "google_client_secret": "csecret",
            "google_redirect_uri": "https://app.test/calendar/callback",
            "token_encryption_key": KEY,
        }
    )
    client = GoogleCalendarClient(
        "cid", "csecret", "https://app.test/calendar/callback", httpx.AsyncClient(transport=httpx.MockTransport(google))
    )
    application = create_app(configured, storage=storage, google_client=client)
    async with application.router.lifespan_context(application):
        yield application


@pytest.fixture(autouse=True)
def google_hosts(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.integrations.google.TOKEN_URL", "https://google.test/token")
    monkeypatch.setattr("app.integrations.google.REVOKE_URL", "https://google.test/revoke")
    monkeypatch.setattr("app.integrations.google.EVENTS_URL", "https://google.test/calendars/primary/events")


BASE = "/v1/integrations/google-calendar"


async def connect(client: AsyncClient, user: uuid.UUID) -> None:
    url = (await client.post(f"{BASE}/authorize", headers=auth_headers(user), json={"return_to": "/profile"})).json()
    state = parse_qs(urlparse(url["authorization_url"]).query)["state"][0]
    response = await client.post(f"{BASE}/callback", headers=auth_headers(user), json={"code": "c", "state": state})
    assert response.json() == {"connected": True, "return_to": "/profile"}


# --- crypto -----------------------------------------------------------------------------------------------------


def test_state_is_bound_to_user_and_expires() -> None:
    signer, me = StateSigner("secret", ttl_seconds=60), uuid.uuid4()
    state = signer.issue(me, "/profile")
    assert signer.verify(state, me) == "/profile"
    with pytest.raises(InvalidState, match="another user"):
        signer.verify(state, uuid.uuid4())
    body, sig = state.split(".")
    # Same signature, payload changed to claim another user: rejected.
    payload = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
    payload["u"] = str(uuid.uuid4())
    forged = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    with pytest.raises(InvalidState, match="signature"):
        signer.verify(f"{forged}.{sig}", uuid.UUID(payload["u"]))
    with pytest.raises(InvalidState):
        signer.verify(f"{body}x.{sig}", me)
    with pytest.raises(InvalidState, match="signature"):
        StateSigner("other-secret").verify(state, me)
    expired = StateSigner("secret", ttl_seconds=-1).issue(me, "/x")
    with pytest.raises(InvalidState, match="expired"):
        signer.verify(expired, me)


def test_token_cipher() -> None:
    cipher = TokenCipher(KEY)
    sealed = cipher.encrypt("refresh-secret")
    assert "refresh-secret" not in sealed and cipher.decrypt(sealed) == "refresh-secret"
    with pytest.raises(ValueError):
        TokenCipher(Fernet.generate_key().decode()).decrypt(sealed)


# --- flow -------------------------------------------------------------------------------------------------------


async def test_authorization_url_uses_fixed_redirect(client: AsyncClient, app: FastAPI) -> None:
    me = await person(app)
    url = (await client.post(f"{BASE}/authorize", headers=auth_headers(me), json={})).json()["authorization_url"]
    query = parse_qs(urlparse(url).query)
    assert query["redirect_uri"] == ["https://app.test/calendar/callback"]
    assert query["scope"] == ["https://www.googleapis.com/auth/calendar.readonly"]
    assert query["access_type"] == ["offline"]


@pytest.mark.parametrize("return_to", ["https://evil.example/", "//evil.example", "javascript:alert(1)"])
async def test_return_to_must_be_an_app_path(client: AsyncClient, app: FastAPI, return_to: str) -> None:
    me = await person(app)
    response = await client.post(f"{BASE}/authorize", headers=auth_headers(me), json={"return_to": return_to})
    assert response.status_code == 422


async def test_connect_stores_only_encrypted_token(client: AsyncClient, app: FastAPI) -> None:
    me = await person(app)
    await connect(client, me)
    assert (await client.get(BASE, headers=auth_headers(me))).json() == {"available": True, "connected": True}
    async with app.state.db.engine.connect() as conn:
        stored = await conn.scalar(
            text("SELECT refresh_token_encrypted FROM calendar_connections WHERE user_id = :u"), {"u": me}
        )
    assert "refresh-secret" not in stored
    assert TokenCipher(KEY).decrypt(stored) == "refresh-secret"


async def test_state_from_another_account_is_rejected(client: AsyncClient, app: FastAPI) -> None:
    """Account-linking CSRF: an attacker's authorization link completed in the victim's session must fail."""
    attacker, victim = await person(app), await person(app)
    url = (await client.post(f"{BASE}/authorize", headers=auth_headers(attacker), json={})).json()["authorization_url"]
    state = parse_qs(urlparse(url).query)["state"][0]
    response = await client.post(f"{BASE}/callback", headers=auth_headers(victim), json={"code": "c", "state": state})
    assert response.status_code == 400
    assert response.json()["code"] == "invalid_state"
    assert (await client.get(BASE, headers=auth_headers(victim))).json()["connected"] is False
    assert (await client.get(BASE, headers=auth_headers(attacker))).json()["connected"] is False


async def test_events(client: AsyncClient, app: FastAPI) -> None:
    me = await person(app)
    assert (await client.get(f"{BASE}/events", headers=auth_headers(me))).status_code == 404
    await connect(client, me)
    events = (await client.get(f"{BASE}/events", headers=auth_headers(me))).json()
    assert [(e["id"], e["title"], e["start"]) for e in events] == [
        ("e1", "Dinner date", "2026-11-01T19:00:00Z"),
        ("e2", "(no title)", "2026-11-02"),
    ]


async def test_revoked_access_disconnects(client: AsyncClient, app: FastAPI, google: FakeGoogle) -> None:
    me = await person(app)
    await connect(client, me)
    google.refresh_valid = False
    response = await client.get(f"{BASE}/events", headers=auth_headers(me))
    assert response.status_code == 409
    assert (await client.get(BASE, headers=auth_headers(me))).json()["connected"] is False


async def test_disconnect_revokes_at_google(client: AsyncClient, app: FastAPI, google: FakeGoogle) -> None:
    me = await person(app)
    await connect(client, me)
    assert (await client.delete(BASE, headers=auth_headers(me))).status_code == 204
    assert google.revoked == ["refresh-secret"]
    assert (await client.get(BASE, headers=auth_headers(me))).json()["connected"] is False


async def test_not_configured(settings: Settings, storage) -> None:  # type: ignore[no-untyped-def]
    app = create_app(settings, storage=storage)
    async with (
        app.router.lifespan_context(app),
        AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c,
    ):
        me = await person(app)
        assert (await c.get(BASE, headers=auth_headers(me))).json() == {"available": False, "connected": False}
        response = await c.post(f"{BASE}/authorize", headers=auth_headers(me), json={})
        assert (response.status_code, response.json()["code"]) == (503, "calendar_not_configured")
