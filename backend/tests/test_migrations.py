"""Alembic migrations: reversible, in sync with the models, and equivalent to the Supabase schema."""

import asyncio
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

import asyncpg
import pytest
from alembic.config import Config

from alembic import command
from tests.conftest import TEST_DATABASE_URL

BACKEND_DIR = Path(__file__).resolve().parents[1]
SUPABASE_DIR = BACKEND_DIR.parent / "supabase"

# Supabase-only objects that the portable schema intentionally leaves out.
SUPABASE_ONLY_CONSTRAINTS = {"profiles_id_fkey"}  # profiles.id -> auth.users.id


def _dsn(database: str) -> str:
    base, _, _ = TEST_DATABASE_URL.rpartition("/")
    return f"{base}/{database}".replace("postgresql+asyncpg://", "postgresql://")


@pytest.fixture
async def make_database() -> AsyncIterator[object]:
    """Factory for empty, uniquely named databases on the test server; all dropped afterwards."""
    created: list[str] = []
    admin = await asyncpg.connect(_dsn("postgres"))

    async def create() -> str:
        name = f"migration_test_{uuid.uuid4().hex[:12]}"
        await admin.execute(f'CREATE DATABASE "{name}"')
        created.append(name)
        return name

    try:
        yield create
    finally:
        for name in created:
            await admin.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')
        await admin.close()


def _alembic_config(database: str) -> Config:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", _dsn(database).replace("postgresql://", "postgresql+asyncpg://"))
    return cfg


async def _alembic(database: str, fn: str, *args: str) -> None:
    # env.py drives its own event loop, so run Alembic commands in a worker thread.
    await asyncio.to_thread(getattr(command, fn), _alembic_config(database), *args)


async def _public_tables(database: str) -> set[str]:
    conn = await asyncpg.connect(_dsn(database))
    try:
        rows = await conn.fetch("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
    finally:
        await conn.close()
    return {r["tablename"] for r in rows}


async def test_upgrade_downgrade_upgrade(make_database) -> None:  # type: ignore[no-untyped-def]
    db = await make_database()
    await _alembic(db, "upgrade", "head")
    assert "matches" in await _public_tables(db)

    await _alembic(db, "downgrade", "base")
    assert await _public_tables(db) == {"alembic_version"}

    await _alembic(db, "upgrade", "head")
    assert "matches" in await _public_tables(db)


async def test_models_match_migrations(make_database) -> None:  # type: ignore[no-untyped-def]
    db = await make_database()
    await _alembic(db, "upgrade", "head")
    # Raises if autogenerate would produce any operation.
    await _alembic(db, "check")


async def test_updated_at_trigger(make_database) -> None:  # type: ignore[no-untyped-def]
    db = await make_database()
    await _alembic(db, "upgrade", "head")
    conn = await asyncpg.connect(_dsn(db))
    try:
        uid = uuid.uuid4()
        await conn.execute(
            "INSERT INTO profiles (id, name, updated_at) VALUES ($1, 'a', now() - interval '1 day')", uid
        )
        await conn.execute("UPDATE profiles SET name = 'b' WHERE id = $1", uid)
        age = await conn.fetchval("SELECT now() - updated_at FROM profiles WHERE id = $1", uid)
    finally:
        await conn.close()
    assert age.total_seconds() < 60


async def test_matches_pair_is_unique_in_both_directions(make_database) -> None:  # type: ignore[no-untyped-def]
    db = await make_database()
    await _alembic(db, "upgrade", "head")
    conn = await asyncpg.connect(_dsn(db))
    try:
        a, b = uuid.uuid4(), uuid.uuid4()
        await conn.execute("INSERT INTO profiles (id) VALUES ($1), ($2)", a, b)
        await conn.execute("INSERT INTO matches (user_id, matched_user_id) VALUES ($1, $2)", a, b)
        with pytest.raises(asyncpg.UniqueViolationError):
            await conn.execute("INSERT INTO matches (user_id, matched_user_id) VALUES ($1, $2)", b, a)
    finally:
        await conn.close()


SCHEMA_QUERIES = {
    "columns": """
        SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name <> 'alembic_version'
        ORDER BY 1, 2
    """,
    "constraints": """
        SELECT conrelid::regclass::text AS table_name, conname, contype,
               pg_get_constraintdef(oid) AS definition
        FROM pg_constraint
        WHERE connamespace = 'public'::regnamespace AND conrelid::regclass::text <> 'alembic_version'
        ORDER BY 1, 2
    """,
    "indexes": """
        SELECT tablename, indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public' AND tablename <> 'alembic_version'
        ORDER BY 1, 2
    """,
}


async def _schema(database: str) -> dict[str, set[tuple[object, ...]]]:
    conn = await asyncpg.connect(_dsn(database))
    try:
        return {name: {tuple(r.values()) for r in await conn.fetch(q)} for name, q in SCHEMA_QUERIES.items()}
    finally:
        await conn.close()


async def test_alembic_schema_matches_supabase_migrations(make_database) -> None:  # type: ignore[no-untyped-def]
    """Columns, types, nullability, defaults, constraints and indexes are identical.

    The only exception is the Supabase-only FK to auth.users, so data can be moved between the two
    with a plain dump/restore.
    """
    supabase_db = await make_database()
    conn = await asyncpg.connect(_dsn(supabase_db))
    try:
        await conn.execute("SET client_min_messages = error")
        await conn.execute((SUPABASE_DIR / "test" / "bootstrap.sql").read_text())
        for migration in sorted((SUPABASE_DIR / "migrations").glob("*.sql")):
            await conn.execute(migration.read_text())
    finally:
        await conn.close()

    alembic_db = await make_database()
    await _alembic(alembic_db, "upgrade", "head")

    supabase_schema = await _schema(supabase_db)
    alembic_schema = await _schema(alembic_db)
    # Supabase marks the self-swipe check NOT VALID (it was added to a table with existing rows).
    supabase_schema["constraints"] = {
        (*c[:3], str(c[3]).replace(" NOT VALID", ""))
        for c in supabase_schema["constraints"]
        if c[1] not in SUPABASE_ONLY_CONSTRAINTS
    }

    for part in SCHEMA_QUERIES:
        only_supabase = sorted(supabase_schema[part] - alembic_schema[part], key=str)
        only_alembic = sorted(alembic_schema[part] - supabase_schema[part], key=str)
        assert not only_supabase and not only_alembic, (
            f"{part} differ\n  only in Supabase migrations: {only_supabase}\n  only in Alembic: {only_alembic}"
        )
