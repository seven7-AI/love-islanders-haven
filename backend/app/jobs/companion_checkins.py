"""Send AI companion check-ins to users who opted in (Settings → AI companion → proactive messages).

Run on a schedule (e.g. every few hours):  python -m app.jobs.companion_checkins [--quiet-hours 48] [--limit 200]
Does nothing (and exits successfully) when no language model is configured.
"""

import argparse
import asyncio

import structlog

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.session import Database, create_engine
from app.integrations.llm import UnconfiguredLLM
from app.main import _default_llm
from app.services.companion import proactive_checkins


async def run(quiet_hours: int, limit: int) -> int:
    settings = get_settings()
    configure_logging(settings.log_level, settings.log_json)
    llm = _default_llm(settings)
    log = structlog.get_logger()
    if isinstance(llm, UnconfiguredLLM):
        log.info("companion_checkins_skipped", reason="no language model configured")
        return 0
    db = Database(create_engine(settings))
    try:
        async with db.sessionmaker() as session:
            sent = await proactive_checkins(session, llm, quiet_hours=quiet_hours, limit=limit)
    finally:
        await db.dispose()
    log.info("companion_checkins_sent", count=sent)
    return sent


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quiet-hours", type=int, default=48)
    parser.add_argument("--limit", type=int, default=200)
    args = parser.parse_args()
    asyncio.run(run(args.quiet_hours, args.limit))


if __name__ == "__main__":
    main()
