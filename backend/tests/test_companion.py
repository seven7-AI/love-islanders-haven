import json
from collections.abc import Callable

import httpx
import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.config import Settings
from app.integrations.llm import ChatTurn, LLMError, OpenAICompatibleLLM
from app.main import create_app
from app.services.companion import proactive_checkins
from tests.conftest import auth_headers
from tests.test_discovery import person, sql


class ScriptedLLM:
    """Test substitute for a language model: records prompts, returns a fixed reply or fails."""

    def __init__(self, reply: str = "Sounds lovely!", fail: bool = False) -> None:
        self.reply, self.fail = reply, fail
        self.calls: list[list[ChatTurn]] = []

    async def complete(self, turns: list[ChatTurn], *, max_tokens: int = 400) -> str:
        self.calls.append(turns)
        if self.fail:
            raise LLMError("boom")
        return self.reply


@pytest.fixture
def llm() -> ScriptedLLM:
    return ScriptedLLM()


@pytest.fixture
async def app(settings: Settings, storage, llm: ScriptedLLM):  # type: ignore[no-untyped-def]
    application = create_app(settings.model_copy(update={"companion_messages_per_hour": 3}), storage=storage, llm=llm)
    async with application.router.lifespan_context(application):
        yield application


async def test_exchange_is_stored_server_side(client: AsyncClient, app: FastAPI, llm: ScriptedLLM) -> None:
    me = await person(app)
    await sql(
        app,
        "INSERT INTO user_settings (user_id, preferences) VALUES (:me, :p)",
        me=me,
        p=json.dumps({"ai_companion_settings": {"conversationStyle": "caring"}}),
    )
    response = await client.post(
        "/v1/companion/messages", headers=auth_headers(me), json={"content": "First date tips?"}
    )
    assert response.status_code == 201
    body = response.json()
    assert (body["user_message"]["content"], body["reply"]["content"]) == ("First date tips?", "Sounds lovely!")
    system = llm.calls[0][0]
    assert system.role == "system" and "warm and caring" in system.content
    history = (await client.get("/v1/companion/messages", headers=auth_headers(me))).json()["messages"]
    assert [(m["role"], m["content"]) for m in history] == [
        ("user", "First date tips?"),
        ("assistant", "Sounds lovely!"),
    ]


async def test_history_is_sent_as_context(client: AsyncClient, app: FastAPI, llm: ScriptedLLM) -> None:
    me = await person(app)
    await client.post("/v1/companion/messages", headers=auth_headers(me), json={"content": "one"})
    await client.post("/v1/companion/messages", headers=auth_headers(me), json={"content": "two"})
    assert [t.content for t in llm.calls[1][1:]] == ["one", "Sounds lovely!", "two"]


async def test_failed_reply_stores_nothing(client: AsyncClient, app: FastAPI, llm: ScriptedLLM) -> None:
    me = await person(app)
    llm.fail = True
    response = await client.post("/v1/companion/messages", headers=auth_headers(me), json={"content": "hello"})
    assert response.status_code == 502
    assert (await client.get("/v1/companion/messages", headers=auth_headers(me))).json()["messages"] == []


async def test_rate_limit(client: AsyncClient, app: FastAPI) -> None:
    me = await person(app)
    for i in range(3):
        assert (
            await client.post("/v1/companion/messages", headers=auth_headers(me), json={"content": str(i)})
        ).status_code == 201
    limited = await client.post("/v1/companion/messages", headers=auth_headers(me), json={"content": "again"})
    assert limited.status_code == 429


async def test_without_a_model_the_api_says_so(settings: Settings, storage) -> None:  # type: ignore[no-untyped-def]
    app = create_app(settings, storage=storage)  # no LLM key in test settings
    async with (
        app.router.lifespan_context(app),
        AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c,
    ):
        me = await person(app)
        response = await c.post("/v1/companion/messages", headers=auth_headers(me), json={"content": "hi"})
        assert response.status_code == 503
        assert response.json()["code"] == "ai_not_configured"
        assert (await c.get("/v1/companion/messages", headers=auth_headers(me))).json()["messages"] == []


async def test_only_text_is_accepted(client: AsyncClient, app: FastAPI) -> None:
    me = await person(app)
    spoof = {"content": "x", "role": "assistant"}
    assert (await client.post("/v1/companion/messages", headers=auth_headers(me), json=spoof)).status_code == 422
    assert (
        await client.post("/v1/companion/messages", headers=auth_headers(me), json={"content": ""})
    ).status_code == 422


async def test_proactive_checkins_only_for_opted_in_quiet_users(app: FastAPI, llm: ScriptedLLM) -> None:
    opted_in, opted_out, chatty = await person(app), await person(app), await person(app)
    on = json.dumps({"ai_companion_settings": {"allowProactiveMessages": True}})
    off = json.dumps({"ai_companion_settings": {"allowProactiveMessages": False}})
    for user, prefs in ((opted_in, on), (opted_out, off), (chatty, on)):
        await sql(app, "INSERT INTO user_settings (user_id, preferences) VALUES (:u, :p)", u=user, p=prefs)
    await sql(app, "INSERT INTO ai_chat_history (user_id, role, message_content) VALUES (:u, 'user', 'hi')", u=chatty)
    async with app.state.db.sessionmaker() as session:
        assert await proactive_checkins(session, llm, quiet_hours=48, limit=10) == 1
    async with app.state.db.engine.connect() as conn:
        row = (
            await conn.execute(text("SELECT user_id, message_type FROM ai_chat_history WHERE role = 'assistant'"))
        ).one()
    assert (row.user_id, row.message_type) == (opted_in, "proactive")


def openai(handler: Callable[[httpx.Request], httpx.Response]) -> OpenAICompatibleLLM:
    return OpenAICompatibleLLM(
        "key", "test-model", "https://llm.test/v1", httpx.AsyncClient(transport=httpx.MockTransport(handler))
    )


async def test_openai_client_request_and_response() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url == "https://llm.test/v1/chat/completions"
        assert request.headers["Authorization"] == "Bearer key"
        body = json.loads(request.content)
        assert body["model"] == "test-model" and body["messages"][0] == {"role": "system", "content": "s"}
        return httpx.Response(200, json={"choices": [{"message": {"content": " hi there "}}]})

    assert await openai(handler).complete([ChatTurn("system", "s"), ChatTurn("user", "u")]) == "hi there"


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(500),
        httpx.Response(200, json={"choices": []}),
        httpx.Response(200, json={"choices": [{"message": {"content": "  "}}]}),
    ],
)
async def test_openai_client_errors(response: httpx.Response) -> None:
    with pytest.raises(LLMError):
        await openai(lambda r: response).complete([ChatTurn("user", "u")])
