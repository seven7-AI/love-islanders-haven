import uuid

from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from tests.auth_helpers import hs256_token


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def test_requires_a_token(client: AsyncClient) -> None:
    response = await client.get("/v1/me")
    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"
    assert response.headers["content-type"] == "application/problem+json"


async def test_rejects_an_invalid_token(client: AsyncClient) -> None:
    response = await client.get("/v1/me", headers=auth("not-a-jwt"))
    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"


async def test_returns_the_token_user_and_creates_their_profile(client: AsyncClient, app) -> None:  # type: ignore[no-untyped-def]
    sub = uuid.uuid4()
    response = await client.get("/v1/me", headers=auth(hs256_token(sub=sub)))
    assert response.status_code == 200
    body = response.json()
    assert body == {
        "id": str(sub),
        "email": "ava@example.com",
        "name": "Ava",
        "onboarding_completed": False,
        "email_verified": False,
    }
    engine: AsyncEngine = app.state.db.engine
    async with engine.connect() as conn:
        onboarding = await conn.scalar(
            text("SELECT count(*) FROM profile_onboarding WHERE profile_id = :id"), {"id": sub}
        )
    assert onboarding == 1


async def test_existing_profile_is_not_overwritten(client: AsyncClient, app) -> None:  # type: ignore[no-untyped-def]
    sub = uuid.uuid4()
    async with app.state.db.engine.begin() as conn:
        await conn.execute(
            text("INSERT INTO profiles (id, name, onboarding_completed) VALUES (:id, 'Existing', true)"), {"id": sub}
        )
    response = await client.get("/v1/me", headers=auth(hs256_token(sub=sub)))
    assert response.json()["name"] == "Existing"
    assert response.json()["onboarding_completed"] is True
