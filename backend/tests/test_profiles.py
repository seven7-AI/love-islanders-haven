import uuid
from datetime import date, timedelta

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy import text

from tests.conftest import auth_headers
from tests.fakes import FakeStorage

BUCKET = "profile-images"


def years_ago(years: int, days: int = 0) -> str:
    today = date.today()
    return (today.replace(year=today.year - years) + timedelta(days=days)).isoformat()


@pytest.fixture
def me() -> uuid.UUID:
    return uuid.uuid4()


async def add_photo(client: AsyncClient, storage: FakeStorage, user: uuid.UUID) -> dict[str, object]:
    ticket = (
        await client.post(
            "/v1/me/images/uploads", headers=auth_headers(user), json={"content_type": "image/jpeg", "size_bytes": 1000}
        )
    ).json()
    storage.put(ticket["bucket"], ticket["path"])
    response = await client.post("/v1/me/images", headers=auth_headers(user), json={"path": ticket["path"]})
    assert response.status_code == 201, response.text
    return response.json()  # type: ignore[no-any-return]


async def onboard(client: AsyncClient, storage: FakeStorage, user: uuid.UUID, **fields: object) -> None:
    body = {"name": "Ava", "dob": years_ago(25), "gender": "female", "gender_preference": "male", **fields}
    assert (await client.patch("/v1/me/profile", headers=auth_headers(user), json=body)).status_code == 200
    for _ in range(4):
        await add_photo(client, storage, user)
    response = await client.put("/v1/me/onboarding", headers=auth_headers(user), json={"step": "completed"})
    assert response.status_code == 200, response.text


# --- profile updates -------------------------------------------------------------------------------------------


async def test_update_profile_and_derive_age(client: AsyncClient, me: uuid.UUID) -> None:
    response = await client.patch(
        "/v1/me/profile", headers=auth_headers(me), json={"bio": "Hello", "dob": years_ago(30), "interests": ["hiking"]}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["bio"] == "Hello"
    assert body["age"] == 30
    assert body["interests"] == ["hiking"]


async def test_rejects_under_18(client: AsyncClient, me: uuid.UUID) -> None:
    response = await client.patch("/v1/me/profile", headers=auth_headers(me), json={"dob": years_ago(18, days=1)})
    assert response.status_code == 422
    assert response.json()["code"] == "underage"


async def test_accepts_exactly_18(client: AsyncClient, me: uuid.UUID) -> None:
    response = await client.patch("/v1/me/profile", headers=auth_headers(me), json={"dob": years_ago(18)})
    assert response.status_code == 200
    assert response.json()["age"] == 18


@pytest.mark.parametrize("field", [{"verified": True}, {"email_verified": True}, {"streak_count": 9}, {"age": 40}])
async def test_rejects_server_managed_fields(client: AsyncClient, me: uuid.UUID, field: dict[str, object]) -> None:
    response = await client.patch("/v1/me/profile", headers=auth_headers(me), json=field)
    assert response.status_code == 422


async def test_rejects_inverted_age_range(client: AsyncClient, me: uuid.UUID) -> None:
    response = await client.patch(
        "/v1/me/profile", headers=auth_headers(me), json={"age_range_min": 40, "age_range_max": 30}
    )
    assert response.status_code == 422


# --- onboarding ------------------------------------------------------------------------------------------------


async def test_onboarding_cannot_complete_with_missing_details(client: AsyncClient, me: uuid.UUID) -> None:
    response = await client.put("/v1/me/onboarding", headers=auth_headers(me), json={"step": "completed"})
    assert response.status_code == 422
    assert "at least 4 photos" in response.json()["detail"]
    assert "dob" in response.json()["detail"]


async def test_onboarding_completes(client: AsyncClient, storage: FakeStorage, me: uuid.UUID, app: FastAPI) -> None:
    await onboard(client, storage, me)
    body = (await client.get("/v1/me/profile", headers=auth_headers(me))).json()
    assert body["onboarding_completed"] is True
    assert body["onboarding_step"] == "completed"
    async with app.state.db.engine.connect() as conn:
        assert await conn.scalar(text("SELECT completed FROM profile_onboarding WHERE profile_id = :id"), {"id": me})


async def test_going_back_after_completion_clears_both_flags(
    client: AsyncClient, storage: FakeStorage, me: uuid.UUID, app: FastAPI
) -> None:
    await onboard(client, storage, me)
    response = await client.put("/v1/me/onboarding", headers=auth_headers(me), json={"step": "preferences"})
    assert response.json()["onboarding_completed"] is False
    async with app.state.db.engine.connect() as conn:
        flags = (
            await conn.execute(
                text(
                    "SELECT p.onboarding_completed, o.completed FROM profiles p "
                    "JOIN profile_onboarding o ON o.profile_id = p.id WHERE p.id = :id"
                ),
                {"id": me},
            )
        ).one()
    assert tuple(flags) == (False, False)
    # Out of discovery until completed again.
    viewer = uuid.uuid4()
    assert (await client.get(f"/v1/profiles/{me}", headers=auth_headers(viewer))).status_code == 404
    assert (await client.put("/v1/me/onboarding", headers=auth_headers(me), json={"step": "completed"})).json()[
        "onboarding_completed"
    ] is True


async def test_onboarding_step_is_recorded(client: AsyncClient, me: uuid.UUID) -> None:
    response = await client.put("/v1/me/onboarding", headers=auth_headers(me), json={"step": "photos"})
    assert response.json()["onboarding_step"] == "photos"
    assert response.json()["onboarding_completed"] is False


# --- public profiles -------------------------------------------------------------------------------------------


async def test_public_profile_hides_private_fields(client: AsyncClient, storage: FakeStorage, me: uuid.UUID) -> None:
    other = uuid.uuid4()
    await onboard(client, storage, other, show_age=False)
    hidden = await add_photo(client, storage, other)
    await client.patch(f"/v1/me/images/{hidden['id']}", headers=auth_headers(other), json={"is_visible": False})

    response = await client.get(f"/v1/profiles/{other}", headers=auth_headers(me))
    assert response.status_code == 200
    body = response.json()
    assert "dob" not in body
    assert body["age"] is None
    assert len(body["images"]) == 4  # the hidden fifth photo is not shown


async def test_blocked_profiles_are_not_found(
    client: AsyncClient, storage: FakeStorage, me: uuid.UUID, app: FastAPI
) -> None:
    other = uuid.uuid4()
    await onboard(client, storage, other)
    await client.get("/v1/me", headers=auth_headers(me))
    async with app.state.db.engine.begin() as conn:
        await conn.execute(
            text("INSERT INTO blocked_users (user_id, blocked_user_id) VALUES (:a, :b)"), {"a": other, "b": me}
        )
    assert (await client.get(f"/v1/profiles/{other}", headers=auth_headers(me))).status_code == 404


async def test_unfinished_profiles_are_not_found(client: AsyncClient, me: uuid.UUID) -> None:
    other = uuid.uuid4()
    await client.get("/v1/me", headers=auth_headers(other))
    assert (await client.get(f"/v1/profiles/{other}", headers=auth_headers(me))).status_code == 404


# --- images ----------------------------------------------------------------------------------------------------


async def test_upload_ticket_is_scoped_to_the_user(client: AsyncClient, me: uuid.UUID) -> None:
    response = await client.post(
        "/v1/me/images/uploads", headers=auth_headers(me), json={"content_type": "image/png", "size_bytes": 1000}
    )
    assert response.status_code == 201
    assert response.json()["path"].startswith(f"{me}/")
    assert response.json()["path"].endswith(".png")


@pytest.mark.parametrize(
    "body",
    [{"content_type": "image/gif", "size_bytes": 10}, {"content_type": "image/jpeg", "size_bytes": 6 * 1024 * 1024}],
)
async def test_upload_ticket_validates_type_and_size(
    client: AsyncClient, me: uuid.UUID, body: dict[str, object]
) -> None:
    assert (await client.post("/v1/me/images/uploads", headers=auth_headers(me), json=body)).status_code == 422


async def test_cannot_register_another_users_file(client: AsyncClient, storage: FakeStorage, me: uuid.UUID) -> None:
    path = f"{uuid.uuid4()}/photo.jpg"
    storage.put(BUCKET, path)
    response = await client.post("/v1/me/images", headers=auth_headers(me), json={"path": path})
    assert response.status_code == 403


@pytest.mark.parametrize(
    ("stored", "code"),
    [
        ({"size": 6 * 1024 * 1024}, "upload_too_large"),
        ({"data": b"<html><script>alert(1)</script>", "content_type": "text/html"}, "upload_invalid_type"),
        ({"data": b"\x89PNG\r\n\x1a\n" + b"\x00" * 8, "content_type": "image/png"}, "upload_invalid_type"),
        ({"content_type": "text/html"}, "upload_invalid_type"),  # JPEG bytes served as HTML
    ],
)
async def test_register_checks_the_stored_file(
    client: AsyncClient, storage: FakeStorage, me: uuid.UUID, stored: dict[str, object], code: str
) -> None:
    """The ticket was for a .jpg under 5 MB; what was actually uploaded is checked, and rejected files are deleted."""
    ticket = (
        await client.post(
            "/v1/me/images/uploads", headers=auth_headers(me), json={"content_type": "image/jpeg", "size_bytes": 1000}
        )
    ).json()
    storage.put(BUCKET, ticket["path"], **stored)  # type: ignore[arg-type]
    response = await client.post("/v1/me/images", headers=auth_headers(me), json={"path": ticket["path"]})
    assert response.status_code == 422
    assert response.json()["code"] == code
    assert (BUCKET, ticket["path"]) not in storage.objects
    assert (await client.get("/v1/me/profile", headers=auth_headers(me))).json()["images"] == []


async def test_cannot_register_a_file_that_was_not_uploaded(client: AsyncClient, me: uuid.UUID) -> None:
    response = await client.post("/v1/me/images", headers=auth_headers(me), json={"path": f"{me}/missing.jpg"})
    assert response.status_code == 422


async def test_first_photo_becomes_avatar_and_limit_is_enforced(
    client: AsyncClient, storage: FakeStorage, me: uuid.UUID
) -> None:
    first = await add_photo(client, storage, me)
    for _ in range(5):
        await add_photo(client, storage, me)
    profile = (await client.get("/v1/me/profile", headers=auth_headers(me))).json()
    assert profile["images"][0]["url"] == first["url"]
    assert [i["position"] for i in profile["images"]] == list(range(6))
    response = await client.post(
        "/v1/me/images/uploads", headers=auth_headers(me), json={"content_type": "image/jpeg", "size_bytes": 1000}
    )
    assert response.status_code == 409


async def avatar_url(app: FastAPI, user: uuid.UUID) -> str | None:
    async with app.state.db.engine.connect() as conn:
        return await conn.scalar(text("SELECT avatar_url FROM profiles WHERE id = :id"), {"id": user})  # type: ignore[no-any-return]


async def test_avatar_is_the_first_visible_photo(
    client: AsyncClient, storage: FakeStorage, me: uuid.UUID, app: FastAPI
) -> None:
    a = await add_photo(client, storage, me)
    b = await add_photo(client, storage, me)
    c = await add_photo(client, storage, me)
    assert await avatar_url(app, me) == a["url"]

    hide = {"is_visible": False}
    await client.patch(f"/v1/me/images/{a['id']}", headers=auth_headers(me), json=hide)
    assert await avatar_url(app, me) == b["url"]

    await client.put("/v1/me/images/order", headers=auth_headers(me), json={"image_ids": [a["id"], c["id"], b["id"]]})
    assert await avatar_url(app, me) == c["url"]  # a is first but hidden

    await client.delete(f"/v1/me/images/{c['id']}", headers=auth_headers(me))
    assert await avatar_url(app, me) == b["url"]

    await client.patch(f"/v1/me/images/{b['id']}", headers=auth_headers(me), json=hide)
    assert await avatar_url(app, me) is None  # every photo hidden: no avatar rather than a hidden one

    await client.patch(f"/v1/me/images/{a['id']}", headers=auth_headers(me), json={"is_visible": True})
    assert await avatar_url(app, me) == a["url"]


async def test_hidden_avatar_never_reaches_matches(
    client: AsyncClient, storage: FakeStorage, me: uuid.UUID, app: FastAPI
) -> None:
    other = uuid.uuid4()
    await onboard(client, storage, me)
    await onboard(client, storage, other, gender="male", gender_preference="female")
    first, second = (await client.get("/v1/me/profile", headers=auth_headers(other))).json()["images"][:2]
    await client.patch(f"/v1/me/images/{first['id']}", headers=auth_headers(other), json={"is_visible": False})
    for a, b in ((me, other), (other, me)):
        swipe = {"target_id": str(b), "direction": "right"}
        assert (await client.post("/v1/swipes", headers=auth_headers(a), json=swipe)).status_code == 201
    [match] = (await client.get("/v1/matches", headers=auth_headers(me))).json()["matches"]
    assert match["partner"]["photo_url"] == second["url"]


async def test_reorder(client: AsyncClient, storage: FakeStorage, me: uuid.UUID) -> None:
    a = await add_photo(client, storage, me)
    b = await add_photo(client, storage, me)
    bad = await client.put("/v1/me/images/order", headers=auth_headers(me), json={"image_ids": [a["id"]]})
    assert bad.status_code == 422
    ok = await client.put("/v1/me/images/order", headers=auth_headers(me), json={"image_ids": [b["id"], a["id"]]})
    assert [i["id"] for i in ok.json()] == [b["id"], a["id"]]


async def test_cannot_touch_other_users_images(client: AsyncClient, storage: FakeStorage, me: uuid.UUID) -> None:
    other = uuid.uuid4()
    image = await add_photo(client, storage, other)
    assert (await client.delete(f"/v1/me/images/{image['id']}", headers=auth_headers(me))).status_code == 404
    assert (
        await client.patch(f"/v1/me/images/{image['id']}", headers=auth_headers(me), json={"is_visible": False})
    ).status_code == 404


async def test_delete_removes_file_and_renumbers(client: AsyncClient, storage: FakeStorage, me: uuid.UUID) -> None:
    a = await add_photo(client, storage, me)
    b = await add_photo(client, storage, me)
    assert (await client.delete(f"/v1/me/images/{a['id']}", headers=auth_headers(me))).status_code == 204
    assert storage.path_from_public_url(BUCKET, str(a["url"])) not in {p for _, p in storage.objects}
    images = (await client.get("/v1/me/profile", headers=auth_headers(me))).json()["images"]
    assert [(i["id"], i["position"]) for i in images] == [(b["id"], 0)]


async def test_failed_storage_delete_keeps_the_photo(client: AsyncClient, storage: FakeStorage, me: uuid.UUID) -> None:
    image = await add_photo(client, storage, me)
    storage.fail_deletes = True
    response = await client.delete(f"/v1/me/images/{image['id']}", headers=auth_headers(me))
    assert response.status_code == 502
    images = (await client.get("/v1/me/profile", headers=auth_headers(me))).json()["images"]
    assert len(images) == 1


async def test_unconfigured_storage_is_reported(settings) -> None:  # type: ignore[no-untyped-def]
    from httpx import ASGITransport

    from app.main import create_app

    app = create_app(settings)  # no storage credentials in test settings
    async with (
        app.router.lifespan_context(app),
        AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c,
    ):
        response = await c.post(
            "/v1/me/images/uploads",
            headers=auth_headers(uuid.uuid4()),
            json={"content_type": "image/jpeg", "size_bytes": 10},
        )
    assert response.status_code == 503
    assert response.json()["code"] == "storage_not_configured"
