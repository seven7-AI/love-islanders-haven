import uuid
from typing import Any

from sqlalchemy import text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import UserSettings
from app.schemas.settings import Preferences, SettingsOut, SettingsUpdate


async def get_settings(session: AsyncSession, me: uuid.UUID) -> SettingsOut:
    await session.execute(
        text("INSERT INTO user_settings (user_id) VALUES (:me) ON CONFLICT (user_id) DO NOTHING"), {"me": me}
    )
    await session.commit()
    row: Any = (
        await session.execute(
            text(
                "SELECT notifications_enabled, show_online_status, location_sharing, theme, preferences "
                "FROM user_settings WHERE user_id = :me"
            ),
            {"me": me},
        )
    ).one()
    theme = row.theme if row.theme in ("light", "dark", "system") else "system"
    return SettingsOut(
        notifications_enabled=row.notifications_enabled is not False,
        show_online_status=row.show_online_status is not False,
        location_sharing=bool(row.location_sharing),
        theme=theme,
        # Stored preferences were validated on write; drop anything that no longer validates.
        preferences=Preferences.model_validate(
            {k: v for k, v in (row.preferences or {}).items() if k in Preferences.model_fields}
        ),
    )


async def update_settings(session: AsyncSession, me: uuid.UUID, changes: SettingsUpdate) -> SettingsOut:
    current = await get_settings(session, me)
    values = changes.model_dump(exclude_unset=True, exclude={"preferences"})
    if changes.preferences is not None:
        merged = current.preferences.model_dump(exclude_none=True)
        # Each provided group replaces the stored group.
        merged.update(changes.preferences.model_dump(exclude_unset=True, exclude_none=True))
        values["preferences"] = merged
    if values:
        await session.execute(update(UserSettings).where(UserSettings.user_id == me).values(**values))
        await session.commit()
    return await get_settings(session, me)
