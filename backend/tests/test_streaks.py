import asyncio
import uuid
from datetime import timedelta

from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy import text

from app.services.streaks import delete_expired
from tests.conftest import auth_headers
from tests.fakes import FakeStorage
from tests.test_discovery import person, sql

BUCKET = "profile-images"


async def post(
    client: AsyncClient, storage: FakeStorage, user: uuid.UUID, photos: int = 1, **extra: object
) -> dict[str, object]:
    paths = []
    for _ in range(photos):
        ticket = (
            await client.post(
                "/v1/streaks/uploads",
                headers=auth_headers(user),
                json={"content_type": "image/jpeg", "size_bytes": 100},
            )
        ).json()
        storage.put(BUCKET, ticket["path"])
        paths.append(ticket["path"])
    response = await client.post("/v1/streaks", headers=auth_headers(user), json={"media_paths": paths, **extra})
    assert response.status_code == 201, response.text
    return response.json()  # type: ignore[no-any-return]


async def age_posts(app: FastAPI, user: uuid.UUID, days: int) -> None:
    await sql(
        app, "UPDATE streaks SET created_at = created_at - make_interval(days => :d) WHERE user_id = :u", d=days, u=user
    )


async def my_status(client: AsyncClient, user: uuid.UUID) -> dict[str, object]:
    return (await client.get("/v1/streaks/me", headers=auth_headers(user))).json()  # type: ignore[no-any-return]


async def test_streak_counts_consecutive_days(client: AsyncClient, app: FastAPI, storage: FakeStorage) -> None:
    me = await person(app)
    assert (await post(client, storage, me))["streak_count"] == 1
    assert (await post(client, storage, me))["streak_count"] == 1  # same day
    await age_posts(app, me, 1)
    assert (await post(client, storage, me))["streak_count"] == 2  # consecutive day
    assert await my_status(client, me) == {"has_posted_today": True, "streak_count": 2}


async def test_missed_day_resets_on_read_and_on_post(client: AsyncClient, app: FastAPI, storage: FakeStorage) -> None:
    me = await person(app)
    await post(client, storage, me)
    await age_posts(app, me, 1)
    await post(client, storage, me)
    await age_posts(app, me, 2)  # last post now 2 days ago
    assert await my_status(client, me) == {"has_posted_today": False, "streak_count": 0}
    assert (await post(client, storage, me))["streak_count"] == 1


async def test_post_validation(client: AsyncClient, app: FastAPI, storage: FakeStorage) -> None:
    me, other = await person(app), await person(app)
    theirs = f"{other}/streaks/x.jpg"
    storage.put(BUCKET, theirs)
    assert (
        await client.post("/v1/streaks", headers=auth_headers(me), json={"media_paths": [theirs]})
    ).status_code == 403
    missing = {"media_paths": [f"{me}/streaks/missing.jpg"]}
    assert (await client.post("/v1/streaks", headers=auth_headers(me), json=missing)).status_code == 422
    huge = f"{me}/streaks/huge.jpg"
    storage.put(BUCKET, huge, size=6 * 1024 * 1024)
    response = await client.post("/v1/streaks", headers=auth_headers(me), json={"media_paths": [huge]})
    assert (response.status_code, response.json()["code"]) == (422, "upload_too_large")
    assert (await client.post("/v1/streaks", headers=auth_headers(me), json={"media_paths": []})).status_code == 422
    too_long = {"media_paths": [f"{me}/streaks/a.jpg"], "duration_hours": 100}
    assert (await client.post("/v1/streaks", headers=auth_headers(me), json=too_long)).status_code == 422


async def test_feed_hides_expired_and_blocked(client: AsyncClient, app: FastAPI, storage: FakeStorage) -> None:
    me, friend, blocked, expired_author = await person(app), await person(app), await person(app), await person(app)
    visible = await post(client, storage, friend, caption="hello")
    await post(client, storage, blocked)
    await post(client, storage, expired_author)
    await sql(app, "INSERT INTO blocked_users (user_id, blocked_user_id) VALUES (:a, :b)", a=blocked, b=me)
    await sql(app, "UPDATE streaks SET expires_at = now() - interval '1 minute' WHERE user_id = :u", u=expired_author)
    feed = (await client.get("/v1/streaks", headers=auth_headers(me))).json()
    assert [p["id"] for p in feed["posts"]] == [visible["id"]]
    assert feed["posts"][0]["caption"] == "hello"
    assert feed["posts"][0]["images"][0].startswith("https://storage.test/")


async def test_likes_are_idempotent_and_counted(client: AsyncClient, app: FastAPI, storage: FakeStorage) -> None:
    author, me = await person(app), await person(app)
    streak = await post(client, storage, author)
    like_url = f"/v1/streaks/{streak['id']}/like"
    assert (await client.put(like_url, headers=auth_headers(me))).json() == {"liked": True, "likes_count": 1}
    assert (await client.put(like_url, headers=auth_headers(me))).json() == {"liked": True, "likes_count": 1}
    feed = (await client.get("/v1/streaks", headers=auth_headers(me))).json()
    assert feed["posts"][0]["liked_by_me"] is True
    assert (await client.delete(like_url, headers=auth_headers(me))).json() == {"liked": False, "likes_count": 0}
    assert (await client.delete(like_url, headers=auth_headers(me))).json() == {"liked": False, "likes_count": 0}


async def test_concurrent_likes_keep_the_counter_exact(client: AsyncClient, app: FastAPI, storage: FakeStorage) -> None:
    author = await person(app)
    streak = await post(client, storage, author)
    likers = [await person(app) for _ in range(8)]
    await asyncio.gather(*(client.put(f"/v1/streaks/{streak['id']}/like", headers=auth_headers(u)) for u in likers))
    async with app.state.db.engine.connect() as conn:
        stored = await conn.scalar(text("SELECT likes_count FROM streaks WHERE id = :id"), {"id": streak["id"]})
        rows = await conn.scalar(text("SELECT count(*) FROM streak_likes WHERE streak_id = :id"), {"id": streak["id"]})
    assert stored == rows == 8


async def test_cannot_like_hidden_posts(client: AsyncClient, app: FastAPI, storage: FakeStorage) -> None:
    author, me = await person(app), await person(app)
    streak = await post(client, storage, author)
    await sql(app, "INSERT INTO blocked_users (user_id, blocked_user_id) VALUES (:a, :b)", a=me, b=author)
    assert (await client.put(f"/v1/streaks/{streak['id']}/like", headers=auth_headers(me))).status_code == 404
    assert (await client.put(f"/v1/streaks/{uuid.uuid4()}/like", headers=auth_headers(me))).status_code == 404


async def test_leaderboard_uses_effective_streaks(client: AsyncClient, app: FastAPI, storage: FakeStorage) -> None:
    me, active, lapsed = await person(app), await person(app), await person(app)
    for user in (active, lapsed):
        await post(client, storage, user)
        await age_posts(app, user, 1)
        await post(client, storage, user)
    await age_posts(app, lapsed, 3)
    board = (await client.get("/v1/streaks/leaderboard", headers=auth_headers(me))).json()
    assert board == [{"user_id": str(active), "name": board[0]["name"], "streak_count": 2}]


async def test_expiry_job_removes_old_posts_and_photos(client: AsyncClient, app: FastAPI, storage: FakeStorage) -> None:
    author = await person(app)
    old = await post(client, storage, author)
    fresh = await post(client, storage, author)
    await sql(app, "UPDATE streaks SET expires_at = now() - interval '2 days' WHERE id = :id", id=old["id"])
    async with app.state.db.sessionmaker() as session:
        removed = await delete_expired(session, storage, BUCKET, older_than=timedelta(hours=24))
    assert removed == 1
    old_path = storage.path_from_public_url(BUCKET, str(old["images"][0]))  # type: ignore[index]
    assert (BUCKET, old_path) not in storage.objects
    async with app.state.db.engine.connect() as conn:
        ids = {str(r) for r in (await conn.scalars(text("SELECT id FROM streaks"))).all()}
    assert ids == {fresh["id"]}


async def test_expiry_job_keeps_posts_when_storage_fails(
    app: FastAPI, client: AsyncClient, storage: FakeStorage
) -> None:
    author = await person(app)
    old = await post(client, storage, author)
    await sql(app, "UPDATE streaks SET expires_at = now() - interval '2 days' WHERE id = :id", id=old["id"])
    storage.fail_deletes = True
    async with app.state.db.sessionmaker() as session:
        assert await delete_expired(session, storage, BUCKET, older_than=timedelta(hours=24)) == 0
