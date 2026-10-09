"""Google Calendar connection: OAuth (state bound to the signed-in user), encrypted token storage, read-only events."""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.crypto import InvalidState, StateSigner, TokenCipher
from app.core.errors import AppError
from app.db.models import CalendarConnection
from app.integrations.google import GoogleAuthRevoked, GoogleCalendarClient, GoogleError
from app.schemas.calendar import CalendarEventOut


@dataclass(frozen=True)
class CalendarConfig:
    client: GoogleCalendarClient
    cipher: TokenCipher
    signer: StateSigner


def build_config(settings: Settings, client: GoogleCalendarClient | None = None) -> CalendarConfig | None:
    if not (
        settings.google_client_id
        and settings.google_client_secret
        and settings.google_redirect_uri
        and settings.token_encryption_key
    ):
        return None
    return CalendarConfig(
        client=client
        or GoogleCalendarClient(settings.google_client_id, settings.google_client_secret, settings.google_redirect_uri),
        cipher=TokenCipher(settings.token_encryption_key),
        signer=StateSigner(settings.oauth_state_secret or settings.token_encryption_key),
    )


def require(config: CalendarConfig | None) -> CalendarConfig:
    if config is None:
        raise AppError(503, "Google Calendar is not available right now.", code="calendar_not_configured")
    return config


def _google_failed(exc: GoogleError) -> AppError:
    return AppError(502, "Google Calendar could not be reached; please try again.", code="google_failed")


async def status(session: AsyncSession, config: CalendarConfig | None, me: uuid.UUID) -> tuple[bool, bool]:
    return config is not None, (await session.get(CalendarConnection, me)) is not None


def authorization_url(config: CalendarConfig, me: uuid.UUID, return_to: str) -> str:
    return config.client.authorization_url(config.signer.issue(me, return_to))


async def complete(session: AsyncSession, config: CalendarConfig, me: uuid.UUID, code: str, state: str) -> str:
    try:
        return_to = config.signer.verify(state, me)
    except InvalidState as exc:
        raise AppError(
            400, "This Google sign-in link is invalid or expired; please try again.", code="invalid_state"
        ) from exc
    try:
        refresh_token, scope = await config.client.exchange_code(code)
    except GoogleError as exc:
        raise _google_failed(exc) from exc
    existing = await session.get(CalendarConnection, me)
    encrypted = config.cipher.encrypt(refresh_token)
    if existing is None:
        session.add(CalendarConnection(user_id=me, refresh_token_encrypted=encrypted, scope=scope))
    else:
        existing.refresh_token_encrypted, existing.scope = encrypted, scope
    await session.commit()
    return return_to


async def events(session: AsyncSession, config: CalendarConfig, me: uuid.UUID) -> list[CalendarEventOut]:
    connection = await session.get(CalendarConnection, me)
    if connection is None:
        raise AppError(404, "Google Calendar is not connected", code="not_connected")
    try:
        access = await config.client.access_token(config.cipher.decrypt(connection.refresh_token_encrypted))
        now = datetime.now(UTC)
        found = await config.client.events(access, now - timedelta(days=30), now + timedelta(days=90))
    except GoogleAuthRevoked as exc:
        await session.delete(connection)
        await session.commit()
        raise AppError(409, "Google Calendar access was revoked; connect it again.", code="not_connected") from exc
    except GoogleError as exc:
        raise _google_failed(exc) from exc
    return [
        CalendarEventOut(id=e.id, title=e.title, location=e.location, notes=e.notes, start=e.start, end=e.end)
        for e in found
    ]


async def disconnect(session: AsyncSession, config: CalendarConfig | None, me: uuid.UUID) -> None:
    connection = await session.get(CalendarConnection, me)
    if connection is None:
        return
    if config is not None:
        try:
            await config.client.revoke(config.cipher.decrypt(connection.refresh_token_encrypted))
        except (GoogleError, ValueError):
            pass  # the stored token is removed regardless; revocation at Google is best effort
    await session.delete(connection)
    await session.commit()
