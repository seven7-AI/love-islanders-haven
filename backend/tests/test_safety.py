import uuid

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.config import Settings
from app.integrations.alerts import AlertRecipient
from app.main import create_app
from tests.conftest import auth_headers
from tests.test_discovery import person, sql

# --- settings ---------------------------------------------------------------------------------------------------


async def test_settings_defaults_and_round_trip(client: AsyncClient, app: FastAPI) -> None:
    me = await person(app)
    initial = (await client.get("/v1/me/settings", headers=auth_headers(me))).json()
    assert initial == {
        "notifications_enabled": True,
        "show_online_status": True,
        "location_sharing": False,
        "theme": "system",
        "preferences": {
            "accessibility_settings": None,
            "app_customization": None,
            "ai_companion_settings": None,
            "match_preferences": None,
        },
    }
    body = {
        "theme": "dark",
        "notifications_enabled": False,
        "preferences": {
            "accessibility_settings": {"textSize": 120, "highContrast": True},
            "ai_companion_settings": {"conversationStyle": "caring", "messageFrequency": 3},
        },
    }
    updated = (await client.patch("/v1/me/settings", headers=auth_headers(me), json=body)).json()
    assert updated["theme"] == "dark" and updated["notifications_enabled"] is False
    assert updated["preferences"]["accessibility_settings"]["textSize"] == 120
    # A later update of one group leaves the others alone.
    again = (
        await client.patch(
            "/v1/me/settings",
            headers=auth_headers(me),
            json={"preferences": {"app_customization": {"animations": False}}},
        )
    ).json()
    assert again["preferences"]["app_customization"]["animations"] is False
    assert again["preferences"]["ai_companion_settings"]["conversationStyle"] == "caring"


@pytest.mark.parametrize(
    "body",
    [
        {"theme": "neon"},
        {"twoFactor": True},
        {"preferences": {"security_settings": {"twoFactor": True}}},
        {"preferences": {"accessibility_settings": {"textSize": 400}}},
        {"preferences": {"ai_companion_settings": {"unknown": 1}}},
    ],
)
async def test_settings_validation(client: AsyncClient, app: FastAPI, body: dict[str, object]) -> None:
    me = await person(app)
    assert (await client.patch("/v1/me/settings", headers=auth_headers(me), json=body)).status_code == 422


# --- blocking and reports ---------------------------------------------------------------------------------------


async def test_block_closes_match_and_unblock_keeps_it_closed(client: AsyncClient, app: FastAPI) -> None:
    me, other = await person(app), await person(app)
    match_id = uuid.uuid4()
    await sql(
        app,
        "INSERT INTO matches (id, user_id, matched_user_id, status) VALUES (:id, :a, :b, 'active')",
        id=match_id,
        a=other,
        b=me,
    )
    assert (await client.post("/v1/blocks", headers=auth_headers(me), json={"user_id": str(other)})).status_code == 201
    assert (await client.post("/v1/blocks", headers=auth_headers(me), json={"user_id": str(other)})).status_code == 201
    blocks = (await client.get("/v1/blocks", headers=auth_headers(me))).json()
    assert [b["user_id"] for b in blocks] == [str(other)]
    assert (await client.delete(f"/v1/blocks/{other}", headers=auth_headers(me))).status_code == 204
    assert (await client.get("/v1/blocks", headers=auth_headers(me))).json() == []
    async with app.state.db.engine.connect() as conn:
        assert await conn.scalar(text("SELECT status FROM matches WHERE id = :id"), {"id": match_id}) == "blocked"


async def test_block_rules(client: AsyncClient, app: FastAPI) -> None:
    me = await person(app)
    assert (await client.post("/v1/blocks", headers=auth_headers(me), json={"user_id": str(me)})).status_code == 422
    unknown = {"user_id": str(uuid.uuid4())}
    assert (await client.post("/v1/blocks", headers=auth_headers(me), json=unknown)).status_code == 404


async def test_report_with_block(client: AsyncClient, app: FastAPI) -> None:
    me, other = await person(app), await person(app)
    response = await client.post(
        "/v1/reports",
        headers=auth_headers(me),
        json={"user_id": str(other), "reason": "harassment", "details": "rude", "also_block": True},
    )
    assert response.status_code == 201
    async with app.state.db.engine.connect() as conn:
        row = (
            await conn.execute(
                text("SELECT reporter_id, reason, status FROM reports WHERE id = :id"), {"id": response.json()["id"]}
            )
        ).one()
    assert (row.reporter_id, row.reason, row.status) == (me, "harassment", "open")
    assert [b["user_id"] for b in (await client.get("/v1/blocks", headers=auth_headers(me))).json()] == [str(other)]


@pytest.mark.parametrize("reason", ["because", ""])
async def test_report_reason_must_be_known(client: AsyncClient, app: FastAPI, reason: str) -> None:
    me, other = await person(app), await person(app)
    body = {"user_id": str(other), "reason": reason}
    assert (await client.post("/v1/reports", headers=auth_headers(me), json=body)).status_code == 422


# --- safety contacts --------------------------------------------------------------------------------------------


async def test_contacts_crud_and_primary(client: AsyncClient, app: FastAPI) -> None:
    me = await person(app)
    a = (
        await client.post(
            "/v1/safety-contacts",
            headers=auth_headers(me),
            json={"name": "Mum", "phone": "+254 700 000000", "is_primary": True},
        )
    ).json()
    b = (
        await client.post(
            "/v1/safety-contacts",
            headers=auth_headers(me),
            json={"name": "Sam", "email": "sam@example.com", "is_primary": True},
        )
    ).json()
    contacts = (await client.get("/v1/safety-contacts", headers=auth_headers(me))).json()
    assert [(c["id"], c["is_primary"]) for c in contacts] == [(b["id"], True), (a["id"], False)]
    renamed = await client.patch(f"/v1/safety-contacts/{a['id']}", headers=auth_headers(me), json={"name": "Mom"})
    assert renamed.json()["name"] == "Mom"
    cleared = await client.patch(f"/v1/safety-contacts/{b['id']}", headers=auth_headers(me), json={"email": None})
    assert cleared.status_code == 422  # would leave the contact unreachable
    assert (await client.delete(f"/v1/safety-contacts/{a['id']}", headers=auth_headers(me))).status_code == 204


@pytest.mark.parametrize(
    "body",
    [
        {"name": "No way to reach"},
        {"name": "X", "phone": "call me"},
        {"name": "X", "email": "not-an-email"},
        {"name": "", "phone": "123456"},
    ],
)
async def test_contact_validation(client: AsyncClient, app: FastAPI, body: dict[str, object]) -> None:
    me = await person(app)
    assert (await client.post("/v1/safety-contacts", headers=auth_headers(me), json=body)).status_code == 422


async def test_contact_limit_and_ownership(client: AsyncClient, app: FastAPI) -> None:
    me, other = await person(app), await person(app)
    for i in range(5):
        await client.post("/v1/safety-contacts", headers=auth_headers(me), json={"name": f"c{i}", "phone": "123456"})
    sixth = await client.post("/v1/safety-contacts", headers=auth_headers(me), json={"name": "c6", "phone": "123456"})
    assert sixth.status_code == 409
    mine = (await client.get("/v1/safety-contacts", headers=auth_headers(me))).json()[0]
    assert (await client.delete(f"/v1/safety-contacts/{mine['id']}", headers=auth_headers(other))).status_code == 404


async def test_legacy_contact_columns_are_read(client: AsyncClient, app: FastAPI) -> None:
    me = await person(app)
    await sql(
        app,
        "INSERT INTO safety_contacts (user_id, contact_name, name, phone_number) "
        "VALUES (:me, '', 'Old Style', '555-1234')",
        me=me,
    )
    contact = (await client.get("/v1/safety-contacts", headers=auth_headers(me))).json()[0]
    assert (contact["name"], contact["phone"]) == ("Old Style", "555-1234")


# --- date plans -------------------------------------------------------------------------------------------------


async def test_date_plans(client: AsyncClient, app: FastAPI) -> None:
    me, other = await person(app), await person(app)
    contact = (
        await client.post("/v1/safety-contacts", headers=auth_headers(me), json={"name": "Mum", "phone": "123456"})
    ).json()
    theirs = (
        await client.post(
            "/v1/safety-contacts", headers=auth_headers(other), json={"name": "Not yours", "phone": "123456"}
        )
    ).json()
    bad = await client.post(
        "/v1/date-plans", headers=auth_headers(me), json={"title": "Coffee", "contact_id": theirs["id"]}
    )
    assert bad.status_code == 422
    plan = (
        await client.post(
            "/v1/date-plans",
            headers=auth_headers(me),
            json={
                "title": "Coffee",
                "location": "Java House",
                "contact_id": contact["id"],
                "date_time": "2026-11-01T18:00:00Z",
            },
        )
    ).json()
    assert plan["status"] == "planned"
    done = await client.patch(f"/v1/date-plans/{plan['id']}", headers=auth_headers(me), json={"status": "completed"})
    assert done.json()["status"] == "completed"
    assert (
        await client.patch(f"/v1/date-plans/{plan['id']}", headers=auth_headers(me), json={"status": "lost"})
    ).status_code == 422
    assert (await client.get("/v1/date-plans", headers=auth_headers(other))).json() == []
    # Deleting the contact keeps the plan.
    await client.delete(f"/v1/safety-contacts/{contact['id']}", headers=auth_headers(me))
    plans = (await client.get("/v1/date-plans", headers=auth_headers(me))).json()
    assert plans[0]["contact_id"] is None
    assert (await client.delete(f"/v1/date-plans/{plan['id']}", headers=auth_headers(other))).status_code == 404
    assert (await client.delete(f"/v1/date-plans/{plan['id']}", headers=auth_headers(me))).status_code == 204


# --- emergency alerts -------------------------------------------------------------------------------------------


async def test_alerts_report_that_no_provider_is_configured(client: AsyncClient, app: FastAPI) -> None:
    me = await person(app)
    no_contacts = await client.post("/v1/safety/alerts", headers=auth_headers(me), json={})
    assert no_contacts.status_code == 422
    await client.post("/v1/safety-contacts", headers=auth_headers(me), json={"name": "Mum", "phone": "123456"})
    response = await client.post("/v1/safety/alerts", headers=auth_headers(me), json={})
    assert response.status_code == 503
    assert response.json()["code"] == "alerts_not_configured"


class RecordingSender:
    """Test substitute for a delivery provider."""

    def __init__(self) -> None:
        self.sent: list[tuple[list[AlertRecipient], str]] = []

    async def send(self, sender_name: str, recipients: list[AlertRecipient], message: str) -> int:
        self.sent.append((recipients, message))
        return len(recipients)


async def test_alerts_go_to_all_contacts_with_location(settings: Settings, storage) -> None:  # type: ignore[no-untyped-def]
    sender = RecordingSender()
    app = create_app(settings, storage=storage, alert_sender=sender)
    async with (
        app.router.lifespan_context(app),
        AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c,
    ):
        me = await person(app)
        for name in ("Mum", "Sam"):
            await c.post("/v1/safety-contacts", headers=auth_headers(me), json={"name": name, "phone": "123456"})
        response = await c.post(
            "/v1/safety/alerts", headers=auth_headers(me), json={"latitude": -1.29, "longitude": 36.82}
        )
    assert response.json() == {"sent_to": 2}
    recipients, message = sender.sent[0]
    assert {r.name for r in recipients} == {"Mum", "Sam"}
    assert "maps.google.com/?q=-1.29,36.82" in message
