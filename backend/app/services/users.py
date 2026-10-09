from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.auth import AuthenticatedUser


async def ensure_profile(session: AsyncSession, user: AuthenticatedUser) -> None:
    """Create the profile (and onboarding row) for a verified user if it does not exist yet.

    On Supabase Postgres a trigger on auth.users already does this; on a standalone database this is where it happens.
    """
    fallback_name = user.name or (user.email.split("@")[0] if user.email else None)
    await session.execute(
        text("INSERT INTO profiles (id, name) VALUES (:id, :name) ON CONFLICT (id) DO NOTHING"),
        {"id": user.id, "name": fallback_name},
    )
    await session.execute(
        text("INSERT INTO profile_onboarding (profile_id) VALUES (:id) ON CONFLICT (profile_id) DO NOTHING"),
        {"id": user.id},
    )
    await session.commit()
