import uuid

from fastapi import APIRouter, Request, Response

from app.api.deps import CurrentUser, SessionDep
from app.core.rate_limit import limited
from app.integrations.alerts import AlertSender
from app.schemas.safety import (
    AlertRequest,
    BlockCreate,
    BlockedUser,
    Contact,
    ContactCreate,
    ContactUpdate,
    DatePlan,
    DatePlanCreate,
    DatePlanUpdate,
    ReportCreate,
    ReportCreated,
)
from app.schemas.settings import SettingsOut, SettingsUpdate
from app.services import safety
from app.services import settings as settings_service

router = APIRouter(prefix="/v1", tags=["settings & safety"])


@router.get("/me/settings")
async def read_settings(user: CurrentUser, session: SessionDep) -> SettingsOut:
    return await settings_service.get_settings(session, user.id)


@router.patch("/me/settings")
async def update_settings(body: SettingsUpdate, user: CurrentUser, session: SessionDep) -> SettingsOut:
    return await settings_service.update_settings(session, user.id, body)


@router.get("/blocks")
async def list_blocks(user: CurrentUser, session: SessionDep) -> list[BlockedUser]:
    return await safety.list_blocks(session, user.id)


@router.post("/blocks", status_code=201, dependencies=limited("blocks", 30))
async def block(body: BlockCreate, user: CurrentUser, session: SessionDep) -> Response:
    await safety.block(session, user.id, body.user_id)
    return Response(status_code=201)


@router.delete("/blocks/{user_id}", status_code=204)
async def unblock(user_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> Response:
    await safety.unblock(session, user.id, user_id)
    return Response(status_code=204)


@router.post("/reports", status_code=201, dependencies=limited("reports", 10))
async def report(body: ReportCreate, user: CurrentUser, session: SessionDep) -> ReportCreated:
    return ReportCreated(id=await safety.report(session, user.id, body))


@router.get("/safety-contacts")
async def list_contacts(user: CurrentUser, session: SessionDep) -> list[Contact]:
    return await safety.list_contacts(session, user.id)


@router.post("/safety-contacts", status_code=201, dependencies=limited("contacts", 20))
async def add_contact(body: ContactCreate, user: CurrentUser, session: SessionDep) -> Contact:
    return await safety.add_contact(session, user.id, body)


@router.patch("/safety-contacts/{contact_id}")
async def update_contact(contact_id: uuid.UUID, body: ContactUpdate, user: CurrentUser, session: SessionDep) -> Contact:
    return await safety.update_contact(session, user.id, contact_id, body)


@router.delete("/safety-contacts/{contact_id}", status_code=204)
async def delete_contact(contact_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> Response:
    await safety.delete_contact(session, user.id, contact_id)
    return Response(status_code=204)


@router.get("/date-plans")
async def list_plans(user: CurrentUser, session: SessionDep) -> list[DatePlan]:
    return await safety.list_plans(session, user.id)


@router.post("/date-plans", status_code=201)
async def add_plan(body: DatePlanCreate, user: CurrentUser, session: SessionDep) -> DatePlan:
    return await safety.add_plan(session, user.id, body)


@router.patch("/date-plans/{plan_id}")
async def update_plan(plan_id: uuid.UUID, body: DatePlanUpdate, user: CurrentUser, session: SessionDep) -> DatePlan:
    return await safety.update_plan(session, user.id, plan_id, body)


@router.delete("/date-plans/{plan_id}", status_code=204)
async def delete_plan(plan_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> Response:
    await safety.delete_plan(session, user.id, plan_id)
    return Response(status_code=204)


@router.post("/safety/alerts", dependencies=limited("alerts", 3))
async def send_alert(body: AlertRequest, request: Request, user: CurrentUser, session: SessionDep) -> dict[str, int]:
    sender: AlertSender = request.app.state.alert_sender
    return {"sent_to": await safety.send_alert(session, sender, user.id, body)}
