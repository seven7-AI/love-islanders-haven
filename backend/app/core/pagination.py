"""Opaque keyset cursors: (timestamp, id) of the last row of a page, base64-encoded."""

import base64
import uuid
from datetime import datetime

from app.core.errors import AppError


def encode_cursor(ts: datetime, row_id: uuid.UUID) -> str:
    return base64.urlsafe_b64encode(f"{ts.isoformat()}|{row_id}".encode()).decode()


def decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    try:
        ts, row_id = base64.urlsafe_b64decode(cursor.encode()).decode().split("|")
        return datetime.fromisoformat(ts), uuid.UUID(row_id)
    except ValueError as exc:
        raise AppError(400, "Invalid cursor", code="invalid_cursor") from exc
