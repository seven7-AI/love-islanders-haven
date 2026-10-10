"""Moderator role, report review, and the operator CLI that grants roles."""

import argparse
import json
import uuid

import httpx
import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy import text

from app import admin
from app.core.config import Settings
from app.services import moderation
from app.services.profiles import NotFound
from tests.conftest import auth_headers, make_settings
from tests.test_discovery import person, sql


async def grant(app: FastAPI, user: uuid.UUID) -> None:
    async with app.state.db.sessionmaker() as session:
        await moderation.grant_role(session, user, "moderator", "test")


async def report(client: AsyncClient, reporter: uuid.UUID, reported: uuid.UUID, reason: str = "spam") -> str:
    response = await client.post(
        "/v1/reports", headers=auth_headers(reporter), json={"user_id": str(reported), "reason": reason}
    )
    assert response.status_code == 201, response.text
    return str(response.json()["id"])


# --- roles -----------------------------------------------------------------------------------------------------


async def test_me_lists_roles(client: AsyncClient, app: FastAPI) -> None:
    me = await person(app)
    assert (await client.get("/v1/me", headers=auth_headers(me))).json()["roles"] == []
    await grant(app, me)
    assert (await client.get("/v1/me", headers=auth_headers(me))).json()["roles"] == ["moderator"]


async def test_grant_and_revoke(app: FastAPI) -> None:
    me = await person(app)
    async with app.state.db.sessionmaker() as session:
        assert await moderation.grant_role(session, me, "moderator", "ops")
        assert not await moderation.grant_role(session, me, "moderator", "ops")  # already granted
        [row] = await moderation.list_roles(session)
        assert (row.user_id, row.role, row.granted_by) == (me, "moderator", "ops")
        assert await moderation.revoke_role(session, me, "moderator")
        assert not await moderation.revoke_role(session, me, "moderator")
        assert await moderation.roles_of(session, me) == []
        with pytest.raises(NotFound):
            await moderation.grant_role(session, uuid.uuid4(), "moderator", "ops")


async def test_only_known_roles_can_be_stored(app: FastAPI) -> None:
    me = await person(app)
    with pytest.raises(Exception, match="user_roles_role_check"):
        await sql(app, "INSERT INTO user_roles (user_id, role) VALUES (:u, 'admin')", u=me)


# --- access ----------------------------------------------------------------------------------------------------


async def test_moderation_needs_the_role(client: AsyncClient, app: FastAPI) -> None:
    user, other = await person(app), await person(app)
    report_id = await report(client, user, other)
    assert (await client.get("/v1/moderation/reports")).status_code == 401
    listed = await client.get("/v1/moderation/reports", headers=auth_headers(user))
    assert (listed.status_code, listed.json()["code"]) == (403, "forbidden")
    patched = await client.patch(
        f"/v1/moderation/reports/{report_id}", headers=auth_headers(user), json={"status": "dismissed"}
    )
    assert patched.status_code == 403
    async with app.state.db.engine.connect() as conn:
        assert await conn.scalar(text("SELECT status FROM reports WHERE id = :id"), {"id": report_id}) == "open"


async def test_revoked_moderators_lose_access(client: AsyncClient, app: FastAPI) -> None:
    mod = await person(app)
    await grant(app, mod)
    assert (await client.get("/v1/moderation/reports", headers=auth_headers(mod))).status_code == 200
    async with app.state.db.sessionmaker() as session:
        await moderation.revoke_role(session, mod, "moderator")
    assert (await client.get("/v1/moderation/reports", headers=auth_headers(mod))).status_code == 403


# --- queue -----------------------------------------------------------------------------------------------------


async def test_queue_lists_reports_oldest_first_with_context(client: AsyncClient, app: FastAPI) -> None:
    mod, a, b, c = [await person(app) for _ in range(4)]
    await grant(app, mod)
    await sql(app, "UPDATE profiles SET name = 'Target' WHERE id = :id", id=c)
    first = await report(client, a, c, "harassment")
    second = await report(client, b, c, "fake_profile")
    third = await report(client, c, a)

    body = (await client.get("/v1/moderation/reports", headers=auth_headers(mod))).json()
    assert [r["id"] for r in body["reports"]] == [first, second, third]
    item = body["reports"][0]
    assert item["reason"] == "harassment"
    assert item["reporter"]["id"] == str(a)
    assert item["reported"] == {
        "id": str(c),
        "name": "Target",
        "photo_url": item["reported"]["photo_url"],
        "reports_against": 2,
    }
    assert item["reviewed_by"] is None

    page = (await client.get("/v1/moderation/reports?limit=2", headers=auth_headers(mod))).json()
    assert [r["id"] for r in page["reports"]] == [first, second]
    rest = (
        await client.get(f"/v1/moderation/reports?limit=2&cursor={page['next_cursor']}", headers=auth_headers(mod))
    ).json()
    assert ([r["id"] for r in rest["reports"]], rest["next_cursor"]) == ([third], None)


async def test_queue_filters_by_status(client: AsyncClient, app: FastAPI) -> None:
    mod, a, b = await person(app), await person(app), await person(app)
    await grant(app, mod)
    open_id = await report(client, a, b)
    done_id = await report(client, b, a)
    await client.patch(f"/v1/moderation/reports/{done_id}", headers=auth_headers(mod), json={"status": "resolved"})
    open_only = (await client.get("/v1/moderation/reports?status=open", headers=auth_headers(mod))).json()
    assert [r["id"] for r in open_only["reports"]] == [open_id]
    assert (await client.get("/v1/moderation/reports?status=closed", headers=auth_headers(mod))).status_code == 422


# --- review ----------------------------------------------------------------------------------------------------


async def test_review_records_moderator_time_and_note(client: AsyncClient, app: FastAPI) -> None:
    mod, a, b = await person(app), await person(app), await person(app)
    await grant(app, mod)
    report_id = await report(client, a, b)
    url = f"/v1/moderation/reports/{report_id}"

    taken = (await client.patch(url, headers=auth_headers(mod), json={"status": "reviewing"})).json()
    assert taken["status"] == "reviewing"
    assert taken["reviewed_by"]["id"] == str(mod)
    assert taken["reviewed_at"] is not None

    note = "Warned the user; profile photos checked."
    done = (
        await client.patch(url, headers=auth_headers(mod), json={"status": "resolved", "resolution_note": note})
    ).json()
    assert (done["status"], done["resolution_note"]) == ("resolved", note)
    assert done["reviewed_at"] >= taken["reviewed_at"]

    # A later status change without a note keeps the earlier note.
    again = (await client.patch(url, headers=auth_headers(mod), json={"status": "dismissed"})).json()
    assert (again["status"], again["resolution_note"]) == ("dismissed", note)


async def test_review_validation(client: AsyncClient, app: FastAPI) -> None:
    mod, a, b = await person(app), await person(app), await person(app)
    await grant(app, mod)
    report_id = await report(client, a, b)
    url = f"/v1/moderation/reports/{report_id}"
    assert (await client.patch(url, headers=auth_headers(mod), json={"status": "open"})).status_code == 422
    too_long = {"status": "resolved", "resolution_note": "x" * 1001}
    assert (await client.patch(url, headers=auth_headers(mod), json=too_long)).status_code == 422
    missing = f"/v1/moderation/reports/{uuid.uuid4()}"
    assert (await client.patch(missing, headers=auth_headers(mod), json={"status": "resolved"})).status_code == 404


async def test_moderators_cannot_review_reports_involving_them(client: AsyncClient, app: FastAPI) -> None:
    mod, other = await person(app), await person(app)
    await grant(app, mod)
    against_me = await report(client, other, mod)
    by_me = await report(client, mod, other)
    for report_id in (against_me, by_me):
        response = await client.patch(
            f"/v1/moderation/reports/{report_id}", headers=auth_headers(mod), json={"status": "dismissed"}
        )
        assert (response.status_code, response.json()["code"]) == (403, "conflict_of_interest")


async def test_deleting_the_reviewer_keeps_the_review(client: AsyncClient, app: FastAPI) -> None:
    mod, a, b = await person(app), await person(app), await person(app)
    await grant(app, mod)
    report_id = await report(client, a, b)
    await client.patch(f"/v1/moderation/reports/{report_id}", headers=auth_headers(mod), json={"status": "resolved"})
    await sql(app, "DELETE FROM profiles WHERE id = :id", id=mod)
    async with app.state.db.engine.connect() as conn:
        row = (
            await conn.execute(text("SELECT status, reviewed_by FROM reports WHERE id = :id"), {"id": report_id})
        ).one()
    assert tuple(row) == ("resolved", None)


# --- operator CLI ----------------------------------------------------------------------------------------------


def cli(*argv: str) -> argparse.Namespace:
    return admin.parse(list(argv))


async def test_cli_grant_list_revoke(app: FastAPI) -> None:
    me = await person(app)
    settings = make_settings()
    assert await admin.run(cli("roles", "list"), settings) == "No roles granted."
    assert await admin.run(cli("roles", "grant", "--user-id", str(me), "--by", "ops"), settings) == (
        f"Granted moderator to {me}"
    )
    assert "already has" in await admin.run(cli("roles", "grant", "--user-id", str(me)), settings)
    listed = await admin.run(cli("roles", "list"), settings)
    assert str(me) in listed and "by ops" in listed
    assert await admin.run(cli("roles", "revoke", "--user-id", str(me)), settings) == f"Revoked moderator from {me}"


async def test_cli_needs_a_profile(app: FastAPI) -> None:
    with pytest.raises(admin.AdminError, match="must sign in"):
        await admin.run(cli("roles", "grant", "--user-id", str(uuid.uuid4())), make_settings())


def test_cli_rejects_unknown_roles() -> None:
    with pytest.raises(SystemExit):
        cli("roles", "grant", "--user-id", str(uuid.uuid4()), "--role", "admin")


def _auth_admin(users: list[dict[str, str]]) -> httpx.AsyncClient:
    """Mocked Supabase Auth admin API (not the real service), 200 users per page."""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "Bearer service-key"
        page = int(request.url.params["page"])
        return httpx.Response(200, content=json.dumps({"users": users[(page - 1) * 200 : page * 200]}))

    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def _settings_with_auth() -> Settings:
    return make_settings(supabase_url="https://proj.supabase.co", supabase_service_role_key="service-key")


async def test_email_lookup_pages_through_users() -> None:
    target = uuid.uuid4()
    users = [{"id": str(uuid.uuid4()), "email": f"user{i}@example.com"} for i in range(250)]
    users.append({"id": str(target), "email": "Mod@Example.com"})
    found = await admin.user_id_for_email(_settings_with_auth(), "mod@example.com", _auth_admin(users))
    assert found == target


async def test_email_lookup_errors() -> None:
    with pytest.raises(admin.AdminError, match="No user"):
        await admin.user_id_for_email(_settings_with_auth(), "nobody@example.com", _auth_admin([]))
    with pytest.raises(admin.AdminError, match="SUPABASE_SERVICE_ROLE_KEY"):
        await admin.user_id_for_email(make_settings(), "a@example.com")
