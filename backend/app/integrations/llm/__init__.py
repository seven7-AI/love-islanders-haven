"""Language-model access for the AI companion, behind a small interface."""

from dataclasses import dataclass
from typing import Literal, Protocol

import httpx


class LLMNotConfigured(Exception):
    pass


class LLMError(Exception):
    """The provider failed or returned something unusable."""


@dataclass(frozen=True)
class ChatTurn:
    role: Literal["system", "user", "assistant"]
    content: str


class LLMProvider(Protocol):
    async def complete(self, turns: list[ChatTurn], *, max_tokens: int = 400) -> str: ...


class UnconfiguredLLM:
    async def complete(self, turns: list[ChatTurn], *, max_tokens: int = 400) -> str:
        raise LLMNotConfigured("No language model is configured")


class OpenAICompatibleLLM:
    """Any provider exposing the OpenAI Chat Completions API (`POST {base_url}/chat/completions`)."""

    def __init__(self, api_key: str, model: str, base_url: str, client: httpx.AsyncClient | None = None) -> None:
        self._url = f"{base_url.rstrip('/')}/chat/completions"
        self._headers = {"Authorization": f"Bearer {api_key}"}
        self._model = model
        self._client = client or httpx.AsyncClient(timeout=30)

    async def complete(self, turns: list[ChatTurn], *, max_tokens: int = 400) -> str:
        try:
            response = await self._client.post(
                self._url,
                headers=self._headers,
                json={
                    "model": self._model,
                    "messages": [{"role": t.role, "content": t.content} for t in turns],
                    "max_tokens": max_tokens,
                },
            )
        except httpx.HTTPError as exc:
            raise LLMError("The language model could not be reached") from exc
        if response.status_code != 200:
            raise LLMError(f"The language model returned {response.status_code}")
        try:
            text = response.json()["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise LLMError("Unexpected response from the language model") from exc
        if not isinstance(text, str) or not text.strip():
            raise LLMError("The language model returned an empty reply")
        return text.strip()
