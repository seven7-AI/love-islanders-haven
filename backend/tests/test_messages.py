import uuid
from datetime import datetime, timedelta

import pytest
from fastapi import FastAPI
from httpx import AsyncClient

from tests.conftest import auth_headers
from tests.fakes import FakeStorage
from tests.test_discovery import person, sql

BUCKET = "chat-media"


@pytest.fixture
async def chat(app: FastAPI) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
    a, b = await person(app), await person(app)
    match_id = uuid.uuid4()
    await sql(
        app,
        "INSERT INTO matches (id, user_id, matched_user_id, status) VALUES (:id, :a, :b, 'active')",
        id=match_id,
        a=a,
        b=b,
    )
    return a, b, match_id


def url(match_id: uuid.UUID, suffix: str = "messages") -> str:
    return f"/v1/matches/{match_id}/{suffix}"


async def send(client: AsyncClient, user: uuid.UUID, match_id: uuid.UUID, content: str = "hi") -> dict[str, object]:
    response = await client.post(url(match_id), headers=auth_headers(user), json={"content": content})
    assert response.status_code == 201, response.text
    return response.json()  # type: ignore[no-any-return]


async def test_members_exchange_messages(client: AsyncClient, chat: tuple[uuid.UUID, uuid.UUID, uuid.UUID]) -> None:
    a, b, match_id = chat
    await send(client, a, match_id, "hello")
    await send(client, b, match_id, "hey!")
    body = (await client.get(url(match_id), headers=auth_headers(a))).json()
    assert [m["content"] for m in body["messages"]] == ["hello", "hey!"]
    assert body["older_cursor"] is None


async def test_outsiders_cannot_read_or_send(
    client: AsyncClient, app: FastAPI, chat: tuple[uuid.UUID, uuid.UUID, uuid.UUID]
) -> None:
    _, _, match_id = chat
    outsider = await person(app)
    assert (await client.get(url(match_id), headers=auth_headers(outsider))).status_code == 404
    assert (await client.post(url(match_id), headers=auth_headers(outsider), json={"content": "x"})).status_code == 404


async def test_blocking_closes_the_conversation(
    client: AsyncClient, app: FastAPI, chat: tuple[uuid.UUID, uuid.UUID, uuid.UUID]
) -> None:
    a, b, match_id = chat
    await sql(app, "INSERT INTO blocked_users (user_id, blocked_user_id) VALUES (:a, :b)", a=b, b=a)
    assert (await client.post(url(match_id), headers=auth_headers(a), json={"content": "x"})).status_code == 404
    assert (await client.post(url(match_id), headers=auth_headers(b), json={"content": "x"})).status_code == 404


async def test_unmatched_conversations_are_closed(
    client: AsyncClient, chat: tuple[uuid.UUID, uuid.UUID, uuid.UUID]
) -> None:
    a, b, match_id = chat
    await client.delete(f"/v1/matches/{match_id}", headers=auth_headers(a))
    assert (await client.post(url(match_id), headers=auth_headers(b), json={"content": "x"})).status_code == 404


@pytest.mark.parametrize(
    "body",
    [
        {"content": "   "},
        {"content": "x" * 2001},
        {"content": "x", "sender_id": "spoof"},
        {"content": "x", "media_path": "a/b/c.jpg"},
        {"content_type": "image"},
    ],
)
async def test_message_validation(
    client: AsyncClient, chat: tuple[uuid.UUID, uuid.UUID, uuid.UUID], body: dict[str, object]
) -> None:
    a, _, match_id = chat
    assert (await client.post(url(match_id), headers=auth_headers(a), json=body)).status_code == 422


async def test_pagination_backwards(
    client: AsyncClient, app: FastAPI, chat: tuple[uuid.UUID, uuid.UUID, uuid.UUID]
) -> None:
    a, b, match_id = chat
    for i in range(7):
        await sql(
            app,
            "INSERT INTO messages (match_id, sender_id, content, created_at) VALUES "
            "(:m, :s, :c, now() - make_interval(mins => :age))",
            m=match_id,
            s=a,
            c=f"m{i}",
            age=10 - i,
        )
    first = (await client.get(url(match_id), headers=auth_headers(b), params={"limit": 3})).json()
    assert [m["content"] for m in first["messages"]] == ["m4", "m5", "m6"]
    second = (
        await client.get(url(match_id), headers=auth_headers(b), params={"limit": 3, "before": first["older_cursor"]})
    ).json()
    assert [m["content"] for m in second["messages"]] == ["m1", "m2", "m3"]
    third = (
        await client.get(url(match_id), headers=auth_headers(b), params={"limit": 3, "before": second["older_cursor"]})
    ).json()
    assert [m["content"] for m in third["messages"]] == ["m0"]
    assert third["older_cursor"] is None


async def test_polling_returns_only_newer_messages(
    client: AsyncClient, chat: tuple[uuid.UUID, uuid.UUID, uuid.UUID]
) -> None:
    a, b, match_id = chat
    first = await send(client, a, match_id, "one")
    await send(client, a, match_id, "two")
    newer = (
        await client.get(url(match_id), headers=auth_headers(b), params={"after": str(first["created_at"])})
    ).json()
    assert [m["content"] for m in newer["messages"]] == ["two"]


async def test_read_receipts(client: AsyncClient, chat: tuple[uuid.UUID, uuid.UUID, uuid.UUID]) -> None:
    a, b, match_id = chat
    await send(client, a, match_id, "one")
    await send(client, a, match_id, "two")
    await send(client, b, match_id, "mine")
    response = await client.post(url(match_id, "read"), headers=auth_headers(b))
    assert response.json() == {"marked_read": 2}
    messages = (await client.get(url(match_id), headers=auth_headers(a))).json()["messages"]
    assert [m["is_read"] for m in messages] == [True, True, False]  # b's own message is not marked by b
    matches = (await client.get("/v1/matches", headers=auth_headers(b))).json()["matches"]
    assert matches[0]["unread_count"] == 0


async def test_media_messages_use_private_signed_urls(
    client: AsyncClient, storage: FakeStorage, chat: tuple[uuid.UUID, uuid.UUID, uuid.UUID]
) -> None:
    a, b, match_id = chat
    ticket = (
        await client.post(
            url(match_id, "media/uploads"),
            headers=auth_headers(a),
            json={"content_type": "image/jpeg", "size_bytes": 1000},
        )
    ).json()
    assert ticket["bucket"] == BUCKET
    assert ticket["path"].startswith(f"{match_id}/{a}/")

    missing = await client.post(
        url(match_id), headers=auth_headers(a), json={"content_type": "image", "media_path": ticket["path"]}
    )
    assert missing.status_code == 422

    storage.put(BUCKET, ticket["path"])
    sent = await client.post(
        url(match_id), headers=auth_headers(a), json={"content_type": "image", "media_path": ticket["path"]}
    )
    assert sent.status_code == 201
    received = (await client.get(url(match_id), headers=auth_headers(b))).json()["messages"][0]
    assert received["media_url"].startswith(f"https://storage.test/signed/{BUCKET}/")
    assert "expires=" in received["media_url"]


async def test_cannot_send_someone_elses_media(
    client: AsyncClient, storage: FakeStorage, chat: tuple[uuid.UUID, uuid.UUID, uuid.UUID]
) -> None:
    a, b, match_id = chat
    path = f"{match_id}/{b}/theirs.jpg"
    storage.put(BUCKET, path)
    response = await client.post(
        url(match_id), headers=auth_headers(a), json={"content_type": "image", "media_path": path}
    )
    assert response.status_code == 403


async def test_after_must_be_a_timestamp(client: AsyncClient, chat: tuple[uuid.UUID, uuid.UUID, uuid.UUID]) -> None:
    a, _, match_id = chat
    response = await client.get(url(match_id), headers=auth_headers(a), params={"after": "yesterday"})
    assert response.status_code == 422
    ok = await client.get(
        url(match_id),
        headers=auth_headers(a),
        params={"after": (datetime.now().astimezone() - timedelta(days=1)).isoformat()},
    )
    assert ok.status_code == 200
