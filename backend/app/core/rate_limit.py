"""Per-user sliding-window rate limits for write-heavy endpoints.

Counters live in process memory, so with N API instances the effective limit is up to N times the configured value.
That is acceptable as abuse protection; anything that must be exact (e.g. the AI companion's hourly quota) is
enforced in the database instead. Set RATE_LIMIT_ENABLED=false to disable (e.g. for load tests).
"""

import time
from collections import defaultdict, deque
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import Depends, Request, Response

from app.api.deps import CurrentUser
from app.core.errors import AppError


class SlidingWindowLimiter:
    def __init__(self) -> None:
        self._hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)

    def hit(self, key: tuple[str, str], limit: int, window_seconds: float, now: float | None = None) -> float | None:
        """Records a hit; returns seconds until the next allowed hit if the limit is exceeded, else None."""
        now = time.monotonic() if now is None else now
        hits = self._hits[key]
        while hits and hits[0] <= now - window_seconds:
            hits.popleft()
        if len(hits) >= limit:
            return hits[0] + window_seconds - now
        hits.append(now)
        return None


def rate_limit(group: str, limit: int, per_seconds: int = 60) -> Callable[..., Awaitable[None]]:
    async def dependency(request: Request, response: Response, user: CurrentUser) -> None:
        if not request.app.state.settings.rate_limit_enabled:
            return
        limiter: SlidingWindowLimiter = request.app.state.rate_limiter
        retry_after = limiter.hit((group, str(user.id)), limit, per_seconds)
        if retry_after is not None:
            raise AppError(429, "Too many requests; please slow down.", code="rate_limited", retry_after=retry_after)

    return dependency


def limited(group: str, limit: int, per_seconds: int = 60) -> list[Any]:
    """Convenience for route decorators: dependencies=limited("swipes", 120)."""
    return [Depends(rate_limit(group, limit, per_seconds))]
