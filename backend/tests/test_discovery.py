import asyncio
import uuid
from datetime import date

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import auth_headers


async def person(
    app: FastAPI,
    *,
    gender: str = "female",
    pref: str = "both",
    age: int = 28,
    onboarded: bool = True,
    age_min: int = 18,
    age_max: int = 99,
    verified: bool = False,
    photos: int = 1,
    hidden_photos: int = 0,
) -> uuid.UUID:
    pid = uuid.uuid4()
    today = date.today()
    async with app.state.db.engine.begin() as conn:
        await conn.execute(
            text(
                "INSERT INTO profiles (id, name, gender, gender_preference, dob, onboarding_completed, "
                "age_range_min, age_range_max, verified) VALUES (:id, :n, :g, :p, :dob, :o, :mn, :mx, :v)"
            ),
            {
                "id": pid,
                "n": f"user-{str(pid)[:4]}",
                "g": gender,
                "p": pref,
                "dob": today.replace(year=today.year - age),
                "o": onboarded,
                "mn": age_min,
                "mx": age_max,
                "v": verified,
            },
        )
        for i in range(photos + hidden_photos):
            await conn.execute(
                text("INSERT INTO profile_images (profile_id, url, position, is_visible) VALUES (:id, :u, :p, :v)"),
                {"id": pid, "u": f"https://img/{pid}/{i}.jpg", "p": i, "v": i < photos},
            )
    return pid


async def feed_ids(client: AsyncClient, me: uuid.UUID, **params: str | int) -> list[str]:
    response = await client.get("/v1/discover", headers=auth_headers(me), params=params)
    assert response.status_code == 200, response.text
    return [p["id"] for p in response.json()["profiles"]]


async def sql(app: FastAPI, statement: str, **params: object) -> None:
    async with app.state.db.engine.begin() as conn:
        await conn.execute(text(statement), params)


# --- feed ------------------------------------------------------------------------------------------------------


async def test_feed_excludes_self_unfinished_swiped_matched_and_blocked(client: AsyncClient, app: FastAPI) -> None:
    me = await person(app, gender="male", pref="female")
    visible = await person(app)
    unfinished = await person(app, onboarded=False)
    swiped = await person(app)
    matched = await person(app)
    i_blocked = await person(app)
    blocked_me = await person(app)
    await sql(app, "INSERT INTO swipes (user_id, swiped_user_id, direction) VALUES (:a, :b, 'left')", a=me, b=swiped)
    await sql(app, "INSERT INTO matches (user_id, matched_user_id, status) VALUES (:a, :b, 'active')", a=matched, b=me)
    await sql(app, "INSERT INTO blocked_users (user_id, blocked_user_id) VALUES (:a, :b)", a=me, b=i_blocked)
    await sql(app, "INSERT INTO blocked_users (user_id, blocked_user_id) VALUES (:a, :b)", a=blocked_me, b=me)

    ids = await feed_ids(client, me)
    assert ids == [str(visible)]
    assert str(unfinished) not in ids


async def test_feed_respects_both_users_gender_preferences(client: AsyncClient, app: FastAPI) -> None:
    me = await person(app, gender="male", pref="female")
    likes_men = await person(app, gender="female", pref="male")
    likes_women = await person(app, gender="female", pref="female")
    a_man = await person(app, gender="male", pref="both")
    ids = await feed_ids(client, me)
    assert str(likes_men) in ids
    assert str(likes_women) not in ids  # her preference excludes me
    assert str(a_man) not in ids  # my preference excludes him


async def test_feed_respects_both_users_age_ranges(client: AsyncClient, app: FastAPI) -> None:
    me = await person(app, gender="male", pref="female", age=40, age_min=30, age_max=45)
    in_range = await person(app, age=35)
    too_young = await person(app, age=25)
    wants_younger = await person(app, age=35, age_max=35)  # I am 40, outside her range
    ids = await feed_ids(client, me)
    assert ids == [str(in_range)]
    assert str(too_young) not in ids and str(wants_younger) not in ids


async def test_feed_verified_only(client: AsyncClient, app: FastAPI) -> None:
    me = await person(app, gender="male", pref="female")
    await sql(app, "UPDATE profiles SET show_me_verified_only = true WHERE id = :id", id=me)
    verified = await person(app, verified=True)
    await person(app, verified=False)
    assert await feed_ids(client, me) == [str(verified)]


async def test_feed_shows_only_visible_photos(client: AsyncClient, app: FastAPI) -> None:
    me = await person(app, gender="male", pref="female")
    await person(app, photos=2, hidden_photos=1)
    profile = (await client.get("/v1/discover", headers=auth_headers(me))).json()["profiles"][0]
    assert len(profile["images"]) == 2
    assert "dob" not in profile


async def test_feed_pagination_is_complete_and_disjoint(client: AsyncClient, app: FastAPI) -> None:
    me = await person(app, gender="male", pref="female")
    expected = {str(await person(app)) for _ in range(5)}
    seen: list[str] = []
    cursor = None
    for _ in range(5):
        params = {"limit": 2, **({"cursor": cursor} if cursor else {})}
        body = (await client.get("/v1/discover", headers=auth_headers(me), params=params)).json()
        seen += [p["id"] for p in body["profiles"]]
        cursor = body["next_cursor"]
        if cursor is None:
            break
    assert sorted(seen) == sorted(expected)
    assert len(seen) == len(set(seen))


async def test_invalid_cursor(client: AsyncClient, app: FastAPI) -> None:
    me = await person(app)
    response = await client.get("/v1/discover", headers=auth_headers(me), params={"cursor": "garbage"})
    assert response.status_code == 400


# --- swipes ----------------------------------------------------------------------------------------------------


async def test_mutual_like_creates_a_match(client: AsyncClient, app: FastAPI) -> None:
    a = await person(app, gender="male", pref="female")
    b = await person(app, gender="female", pref="male")
    first = await client.post("/v1/swipes", headers=auth_headers(a), json={"target_id": str(b), "direction": "right"})
    assert first.json() == {"matched": False, "match_id": None}
    second = await client.post("/v1/swipes", headers=auth_headers(b), json={"target_id": str(a), "direction": "super"})
    assert second.json()["matched"] is True
    matches = (await client.get("/v1/matches", headers=auth_headers(a))).json()["matches"]
    assert [m["id"] for m in matches] == [second.json()["match_id"]]
    assert matches[0]["partner"]["id"] == str(b)


async def test_pass_does_not_match(client: AsyncClient, app: FastAPI) -> None:
    a, b = await person(app), await person(app)
    await client.post("/v1/swipes", headers=auth_headers(a), json={"target_id": str(b), "direction": "right"})
    response = await client.post("/v1/swipes", headers=auth_headers(b), json={"target_id": str(a), "direction": "left"})
    assert response.json()["matched"] is False


async def test_swipe_rules(client: AsyncClient, app: FastAPI) -> None:
    me, other = await person(app), await person(app)
    unfinished = await person(app, onboarded=False)
    blocked = await person(app)
    await sql(app, "INSERT INTO blocked_users (user_id, blocked_user_id) VALUES (:a, :b)", a=blocked, b=me)

    def body(target: uuid.UUID) -> dict[str, str]:
        return {"target_id": str(target), "direction": "right"}

    assert (await client.post("/v1/swipes", headers=auth_headers(me), json=body(me))).status_code == 422
    assert (await client.post("/v1/swipes", headers=auth_headers(me), json=body(unfinished))).status_code == 404
    assert (await client.post("/v1/swipes", headers=auth_headers(me), json=body(blocked))).status_code == 404
    assert (await client.post("/v1/swipes", headers=auth_headers(me), json=body(other))).status_code == 201
    duplicate = await client.post("/v1/swipes", headers=auth_headers(me), json=body(other))
    assert duplicate.status_code == 409


async def test_simultaneous_mutual_likes_create_exactly_one_match(
    client: AsyncClient, app: FastAPI, monkeypatch: pytest.MonkeyPatch
) -> None:
    a, b = await person(app), await person(app)
    # Hold every transaction open a little before committing so the two swipes genuinely overlap.
    original_commit = AsyncSession.commit

    async def slow_commit(self: AsyncSession) -> None:
        await asyncio.sleep(0.3)
        await original_commit(self)

    monkeypatch.setattr(AsyncSession, "commit", slow_commit)
    results = await asyncio.gather(
        client.post("/v1/swipes", headers=auth_headers(a), json={"target_id": str(b), "direction": "right"}),
        client.post("/v1/swipes", headers=auth_headers(b), json={"target_id": str(a), "direction": "right"}),
    )
    assert [r.status_code for r in results] == [201, 201]
    assert sum(r.json()["matched"] for r in results) == 1
    async with app.state.db.engine.connect() as conn:
        count = await conn.scalar(text("SELECT count(*) FROM matches"))
    assert count == 1


# --- matches ---------------------------------------------------------------------------------------------------


async def test_matches_include_last_message_and_unread_count(client: AsyncClient, app: FastAPI) -> None:
    me, partner = await person(app), await person(app)
    match_id = uuid.uuid4()
    await sql(
        app,
        "INSERT INTO matches (id, user_id, matched_user_id, status) VALUES (:id, :a, :b, 'active')",
        id=match_id,
        a=partner,
        b=me,
    )
    await sql(
        app,
        "INSERT INTO messages (match_id, sender_id, content, created_at) VALUES "
        "(:m, :p, 'hi', now() - interval '2 minutes'), (:m, :p, 'you there?', now() - interval '1 minute'), "
        "(:m, :me, 'yes!', now())",
        m=match_id,
        p=partner,
        me=me,
    )
    await sql(app, "UPDATE messages SET is_read = true WHERE content = 'hi'")
    match = (await client.get("/v1/matches", headers=auth_headers(me))).json()["matches"][0]
    assert match["last_message"]["content"] == "yes!"
    assert match["unread_count"] == 1
    assert match["partner"]["photo_url"] == f"https://img/{partner}/0.jpg"


async def test_unmatch(client: AsyncClient, app: FastAPI) -> None:
    me, partner, outsider = await person(app), await person(app), await person(app)
    match_id = uuid.uuid4()
    await sql(
        app,
        "INSERT INTO matches (id, user_id, matched_user_id, status) VALUES (:id, :a, :b, 'active')",
        id=match_id,
        a=partner,
        b=me,
    )
    assert (await client.delete(f"/v1/matches/{match_id}", headers=auth_headers(outsider))).status_code == 404
    assert (await client.delete(f"/v1/matches/{match_id}", headers=auth_headers(me))).status_code == 204
    assert (await client.get("/v1/matches", headers=auth_headers(partner))).json()["matches"] == []


async def test_matches_pagination(client: AsyncClient, app: FastAPI) -> None:
    me = await person(app)
    for _ in range(3):
        other = await person(app)
        await sql(
            app, "INSERT INTO matches (user_id, matched_user_id, status) VALUES (:a, :b, 'active')", a=me, b=other
        )
    first = (await client.get("/v1/matches", headers=auth_headers(me), params={"limit": 2})).json()
    second = (
        await client.get("/v1/matches", headers=auth_headers(me), params={"limit": 2, "cursor": first["next_cursor"]})
    ).json()
    ids = [m["id"] for m in first["matches"] + second["matches"]]
    assert len(ids) == 3 == len(set(ids))
    assert second["next_cursor"] is None
