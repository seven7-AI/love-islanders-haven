import uuid
from typing import Any

from fastapi import FastAPI
from httpx import AsyncClient

from tests.conftest import auth_headers
from tests.fakes import FakeStorage
from tests.test_discovery import person, sql
from tests.test_streaks import post


async def notes(client: AsyncClient, user: uuid.UUID) -> Any:
    return (await client.get("/v1/notifications", headers=auth_headers(user))).json()


async def match(client: AsyncClient, a: uuid.UUID, b: uuid.UUID) -> str:
    await client.post("/v1/swipes", headers=auth_headers(a), json={"target_id": str(b), "direction": "right"})
    result = await client.post("/v1/swipes", headers=auth_headers(b), json={"target_id": str(a), "direction": "right"})
    return str(result.json()["match_id"])


async def test_match_notifies_both_people(client: AsyncClient, app: FastAPI) -> None:
    a, b = await person(app), await person(app)
    match_id = await match(client, a, b)
    for user, other in ((a, b), (b, a)):
        body = await notes(client, user)
        assert body["unread_count"] == 1
        note = body["notifications"][0]
        assert (note["type"], note["match_id"], note["actor_id"]) == ("match", match_id, str(other))


async def test_messages_collapse_into_one_unread_notification(client: AsyncClient, app: FastAPI) -> None:
    a, b = await person(app), await person(app)
    match_id = await match(client, a, b)
    for text in ("hi", "you there?", "hello?"):
        await client.post(f"/v1/matches/{match_id}/messages", headers=auth_headers(a), json={"content": text})
    message_notes = [n for n in (await notes(client, b))["notifications"] if n["type"] == "message"]
    assert len(message_notes) == 1
    assert (await notes(client, a))["unread_count"] == 1  # only a's match notification; own messages do not notify


async def test_streak_likes_notify_the_author_once(client: AsyncClient, app: FastAPI, storage: FakeStorage) -> None:
    author, fan = await person(app), await person(app)
    streak = await post(client, storage, author)
    url = f"/v1/streaks/{streak['id']}/like"
    await client.put(url, headers=auth_headers(fan))
    await client.delete(url, headers=auth_headers(fan))
    await client.put(url, headers=auth_headers(fan))
    await client.put(url, headers=auth_headers(author))  # liking your own post does not notify
    body = await notes(client, author)
    assert [(n["type"], n["actor_id"]) for n in body["notifications"]] == [("streak_like", str(fan))]


async def test_mark_read(client: AsyncClient, app: FastAPI) -> None:
    a, b, c = await person(app), await person(app), await person(app)
    await match(client, a, b)
    await match(client, a, c)
    first = (await notes(client, a))["notifications"][0]["id"]
    marked = await client.post("/v1/notifications/read", headers=auth_headers(a), json={"ids": [first]})
    assert marked.json() == {"marked_read": 1}
    assert (await notes(client, a))["unread_count"] == 1
    # Someone else's ids are ignored.
    other = (await notes(client, b))["notifications"][0]["id"]
    assert (await client.post("/v1/notifications/read", headers=auth_headers(a), json={"ids": [other]})).json() == {
        "marked_read": 0
    }
    await client.post("/v1/notifications/read", headers=auth_headers(a), json={"all": True})
    assert (await notes(client, a))["unread_count"] == 0
    assert (await client.post("/v1/notifications/read", headers=auth_headers(a), json={})).status_code == 422


async def test_blocked_actors_are_hidden(client: AsyncClient, app: FastAPI) -> None:
    a, b = await person(app), await person(app)
    await match(client, a, b)
    await sql(app, "INSERT INTO blocked_users (user_id, blocked_user_id) VALUES (:a, :b)", a=b, b=a)
    assert (await notes(client, a))["notifications"] == []
