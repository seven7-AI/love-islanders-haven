"""Delete streak posts that expired more than a retention period ago, with their photos.

Run on a schedule (e.g. hourly):  python -m app.jobs.expire_streaks [--retention-hours 24]
"""

import argparse
import asyncio
from datetime import timedelta

import structlog

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.session import Database, create_engine
from app.main import _default_storage
from app.services.streaks import delete_expired


async def run(retention: timedelta) -> int:
    settings = get_settings()
    configure_logging(settings.log_level, settings.log_json)
    db = Database(create_engine(settings))
    try:
        async with db.sessionmaker() as session:
            removed = await delete_expired(
                session, _default_storage(settings), settings.profile_images_bucket, older_than=retention
            )
    finally:
        await db.dispose()
    structlog.get_logger().info("expired_streaks_deleted", count=removed)
    return removed


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--retention-hours", type=int, default=24)
    args = parser.parse_args()
    asyncio.run(run(timedelta(hours=args.retention_hours)))


if __name__ == "__main__":
    main()
