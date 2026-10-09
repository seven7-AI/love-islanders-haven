import uuid

from fastapi import FastAPI
from httpx import AsyncClient

from tests.conftest import auth_headers
from tests.test_discovery import person, sql


async def test_insights_from_real_activity(client: AsyncClient, app: FastAPI) -> None:
    me = await person(app, age=30)
    likers = [await person(app, age=age) for age in (22, 27, 45)]
    passer = await person(app)
    await sql(app, "UPDATE profiles SET city = 'Nairobi' WHERE id = ANY(:ids)", ids=likers[:2])
    for liker in likers:
        await sql(
            app, "INSERT INTO swipes (user_id, swiped_user_id, direction) VALUES (:a, :me, 'right')", a=liker, me=me
        )
    await sql(app, "INSERT INTO swipes (user_id, swiped_user_id, direction) VALUES (:a, :me, 'left')", a=passer, me=me)
    # An old like outside the range does not count.
    old = await person(app)
    await sql(
        app,
        "INSERT INTO swipes (user_id, swiped_user_id, direction, created_at) "
        "VALUES (:a, :me, 'right', now() - interval '2 months')",
        a=old,
        me=me,
    )
    # One match: they wrote at t0, I replied 30 minutes later; a second match where they wrote and I never answered.
    m1, m2 = uuid.uuid4(), uuid.uuid4()
    await sql(
        app,
        "INSERT INTO matches (id, user_id, matched_user_id, status) VALUES (:m, :a, :b, 'active')",
        m=m1,
        a=likers[0],
        b=me,
    )
    await sql(
        app,
        "INSERT INTO matches (id, user_id, matched_user_id, status) VALUES (:m, :a, :b, 'active')",
        m=m2,
        a=likers[1],
        b=me,
    )
    await sql(
        app,
        "INSERT INTO messages (match_id, sender_id, content, created_at) VALUES "
        "(:m1, :them, 'hi', now() - interval '60 minutes'), (:m1, :me, 'hey', now() - interval '30 minutes'),"
        "(:m2, :other, 'hello?', now() - interval '10 minutes')",
        m1=m1,
        m2=m2,
        them=likers[0],
        other=likers[1],
        me=me,
    )

    body = (await client.get("/v1/me/insights", headers=auth_headers(me), params={"range": "month"})).json()
    assert (body["times_shown"], body["likes_received"], body["matches"], body["messages_sent"]) == (4, 3, 2, 1)
    assert body["like_to_match_rate"] == round(2 / 3, 3)
    assert body["reply_rate"] == 0.5
    assert body["average_reply_minutes"] == 30.0
    assert {b["label"]: b["count"] for b in body["liker_ages"]} == {"18-24": 1, "25-30": 1, "41+": 1}
    assert body["liker_cities"] == [{"label": "Nairobi", "count": 2}]

    year = (await client.get("/v1/me/insights", headers=auth_headers(me), params={"range": "year"})).json()
    assert year["likes_received"] == 4


async def test_no_activity_gives_no_rates(client: AsyncClient, app: FastAPI) -> None:
    me = await person(app)
    body = (await client.get("/v1/me/insights", headers=auth_headers(me))).json()
    assert (body["like_to_match_rate"], body["reply_rate"], body["average_reply_minutes"]) == (None, None, None)
    assert (
        await client.get("/v1/me/insights", headers=auth_headers(me), params={"range": "decade"})
    ).status_code == 422


async def test_feedback(client: AsyncClient, app: FastAPI) -> None:
    me, other = await person(app), await person(app)
    created = await client.post(
        "/v1/feedback", headers=auth_headers(me), json={"category": "bug", "content": " Crash on login "}
    )
    assert created.status_code == 201 and created.json()["content"] == "Crash on login"
    assert [f["category"] for f in (await client.get("/v1/feedback", headers=auth_headers(me))).json()] == ["bug"]
    assert (await client.get("/v1/feedback", headers=auth_headers(other))).json() == []
    assert (await client.post("/v1/feedback", headers=auth_headers(me), json={"content": "x"})).status_code == 422
