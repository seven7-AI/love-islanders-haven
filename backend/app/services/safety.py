"""Blocking, reporting, safety contacts, date plans and emergency alerts."""

import uuid

from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.models import DatePlan as DatePlanRow
from app.db.models import SafetyContact
from app.integrations.alerts import AlertRecipient, AlertSender, AlertsNotConfigured
from app.schemas.safety import (
    AlertRequest,
    BlockedUser,
    Contact,
    ContactCreate,
    ContactUpdate,
    DatePlan,
    DatePlanCreate,
    DatePlanUpdate,
    ReportCreate,
)
from app.services.profiles import NotFound

MAX_CONTACTS = 5


async def _require_profile(session: AsyncSession, user_id: uuid.UUID) -> None:
    if not await session.scalar(text("SELECT EXISTS (SELECT 1 FROM profiles WHERE id = :id)"), {"id": user_id}):
        raise NotFound("User")


# --- blocking ---------------------------------------------------------------------------------------------------


async def block(session: AsyncSession, me: uuid.UUID, other: uuid.UUID) -> None:
    if other == me:
        raise AppError(422, "You cannot block yourself", code="invalid_target")
    await _require_profile(session, other)
    await session.execute(
        text(
            "INSERT INTO blocked_users (user_id, blocked_user_id) VALUES (:me, :o) "
            "ON CONFLICT (user_id, blocked_user_id) DO NOTHING"
        ),
        {"me": me, "o": other},
    )
    # Close any match between the two (Supabase also does this with a trigger).
    await session.execute(
        text(
            "UPDATE matches SET status = 'blocked' WHERE least(user_id, matched_user_id) = least(CAST(:me AS uuid), "
            "CAST(:o AS uuid)) AND greatest(user_id, matched_user_id) = greatest(CAST(:me AS uuid), CAST(:o AS uuid))"
        ),
        {"me": me, "o": other},
    )
    await session.commit()


async def unblock(session: AsyncSession, me: uuid.UUID, other: uuid.UUID) -> None:
    """Removes the block. A match closed by the block stays closed; they would need to match again."""
    await session.execute(
        text("DELETE FROM blocked_users WHERE user_id = :me AND blocked_user_id = :o"), {"me": me, "o": other}
    )
    await session.commit()


async def list_blocks(session: AsyncSession, me: uuid.UUID) -> list[BlockedUser]:
    rows = (
        await session.execute(
            text(
                "SELECT b.blocked_user_id, coalesce(p.display_name, p.name) AS name, p.avatar_url, b.created_at "
                "FROM blocked_users b JOIN profiles p ON p.id = b.blocked_user_id "
                "WHERE b.user_id = :me ORDER BY b.created_at DESC"
            ),
            {"me": me},
        )
    ).all()
    return [BlockedUser(user_id=r[0], name=r[1], photo_url=r[2], blocked_at=r[3]) for r in rows]


# --- reports ----------------------------------------------------------------------------------------------------


async def report(session: AsyncSession, me: uuid.UUID, body: ReportCreate) -> uuid.UUID:
    if body.user_id == me:
        raise AppError(422, "You cannot report yourself", code="invalid_target")
    await _require_profile(session, body.user_id)
    report_id: uuid.UUID = (
        await session.execute(
            text(
                "INSERT INTO reports (reporter_id, reported_user_id, reason, details) "
                "VALUES (:me, :o, :reason, :details) RETURNING id"
            ),
            {"me": me, "o": body.user_id, "reason": body.reason, "details": body.details},
        )
    ).scalar_one()
    await session.commit()
    if body.also_block:
        await block(session, me, body.user_id)
    return report_id


# --- safety contacts --------------------------------------------------------------------------------------------


def _contact(c: SafetyContact) -> Contact:
    # Older rows used name/phone_number instead of contact_name/contact_phone.
    return Contact(
        id=c.id,
        name=c.contact_name or c.name or "",
        phone=c.contact_phone or c.phone_number,
        email=c.contact_email,
        is_primary=bool(c.is_primary),
    )


async def _contacts(session: AsyncSession, me: uuid.UUID) -> list[SafetyContact]:
    query = (
        select(SafetyContact)
        .where(SafetyContact.user_id == me)
        .order_by(SafetyContact.is_primary.desc(), SafetyContact.created_at)
    )
    return list((await session.scalars(query)).all())


async def list_contacts(session: AsyncSession, me: uuid.UUID) -> list[Contact]:
    return [_contact(c) for c in await _contacts(session, me)]


async def _clear_primary(session: AsyncSession, me: uuid.UUID) -> None:
    await session.execute(update(SafetyContact).where(SafetyContact.user_id == me).values(is_primary=False))


async def add_contact(session: AsyncSession, me: uuid.UUID, body: ContactCreate) -> Contact:
    await session.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:k, 0))"), {"k": f"contacts:{me}"})
    count = await session.scalar(select(func.count()).select_from(SafetyContact).where(SafetyContact.user_id == me))
    if (count or 0) >= MAX_CONTACTS:
        raise AppError(409, f"You can have at most {MAX_CONTACTS} safety contacts", code="too_many_contacts")
    if body.is_primary:
        await _clear_primary(session, me)
    contact = SafetyContact(
        user_id=me,
        contact_name=body.name,
        contact_phone=body.phone,
        contact_email=body.email,
        is_primary=body.is_primary,
    )
    session.add(contact)
    await session.commit()
    await session.refresh(contact)
    return _contact(contact)


async def _own_contact(session: AsyncSession, me: uuid.UUID, contact_id: uuid.UUID) -> SafetyContact:
    contact = await session.get(SafetyContact, contact_id)
    if contact is None or contact.user_id != me:
        raise NotFound("Safety contact")
    return contact


async def update_contact(session: AsyncSession, me: uuid.UUID, contact_id: uuid.UUID, body: ContactUpdate) -> Contact:
    contact = await _own_contact(session, me, contact_id)
    changes = body.model_dump(exclude_unset=True)
    current = _contact(contact)
    phone = changes.get("phone", current.phone)
    email = changes.get("email", current.email)
    if not phone and not email:
        raise AppError(422, "A safety contact needs a phone number or an email address", code="unreachable_contact")
    if changes.get("is_primary"):
        await _clear_primary(session, me)
    contact.contact_name = contact.name = changes.get("name", current.name)
    contact.contact_phone = contact.phone_number = phone
    contact.contact_email = email
    contact.is_primary = changes.get("is_primary", current.is_primary)
    await session.commit()
    return _contact(contact)


async def delete_contact(session: AsyncSession, me: uuid.UUID, contact_id: uuid.UUID) -> None:
    contact = await _own_contact(session, me, contact_id)
    # Date plans that named this contact keep the plan but lose the reference.
    await session.execute(update(DatePlanRow).where(DatePlanRow.contact_id == contact_id).values(contact_id=None))
    await session.delete(contact)
    await session.commit()


# --- date plans -------------------------------------------------------------------------------------------------


def _plan(p: DatePlanRow) -> DatePlan:
    return DatePlan(
        id=p.id,
        title=p.title,
        description=p.description,
        location=p.location,
        date_time=p.date_time,
        partner_name=p.partner_name,
        status=p.status or "planned",
        notes=p.notes,
        contact_id=p.contact_id,
        location_sharing_enabled=bool(p.location_sharing_enabled),
    )


async def _check_contact(session: AsyncSession, me: uuid.UUID, contact_id: uuid.UUID | None) -> None:
    if contact_id is not None:
        contact = await session.get(SafetyContact, contact_id)
        if contact is None or contact.user_id != me:
            raise AppError(422, "The contact must be one of your safety contacts", code="invalid_contact")


async def list_plans(session: AsyncSession, me: uuid.UUID) -> list[DatePlan]:
    query = (
        select(DatePlanRow)
        .where(DatePlanRow.user_id == me)
        .order_by(DatePlanRow.date_time.desc().nulls_last(), DatePlanRow.created_at.desc())
    )
    return [_plan(p) for p in (await session.scalars(query)).all()]


async def add_plan(session: AsyncSession, me: uuid.UUID, body: DatePlanCreate) -> DatePlan:
    await _check_contact(session, me, body.contact_id)
    plan = DatePlanRow(user_id=me, status="planned", **body.model_dump())
    session.add(plan)
    await session.commit()
    await session.refresh(plan)
    return _plan(plan)


async def update_plan(session: AsyncSession, me: uuid.UUID, plan_id: uuid.UUID, body: DatePlanUpdate) -> DatePlan:
    plan = await session.get(DatePlanRow, plan_id)
    if plan is None or plan.user_id != me:
        raise NotFound("Date plan")
    changes = body.model_dump(exclude_unset=True)
    if "contact_id" in changes:
        await _check_contact(session, me, changes["contact_id"])
    for field, value in changes.items():
        setattr(plan, field, value)
    await session.commit()
    await session.refresh(plan)
    return _plan(plan)


async def delete_plan(session: AsyncSession, me: uuid.UUID, plan_id: uuid.UUID) -> None:
    plan = await session.get(DatePlanRow, plan_id)
    if plan is None or plan.user_id != me:
        raise NotFound("Date plan")
    await session.delete(plan)
    await session.commit()


# --- emergency alerts -------------------------------------------------------------------------------------------


async def send_alert(session: AsyncSession, sender: AlertSender, me: uuid.UUID, body: AlertRequest) -> int:
    contacts = await list_contacts(session, me)
    if not contacts:
        raise AppError(422, "Add a safety contact before sending alerts", code="no_contacts")
    name = await session.scalar(text("SELECT coalesce(display_name, name) FROM profiles WHERE id = :me"), {"me": me})
    message = body.message or f"{name or 'Your contact'} has sent you an emergency alert from Love Islander."
    if body.latitude is not None and body.longitude is not None:
        message += f" Location: https://maps.google.com/?q={body.latitude},{body.longitude}"
    try:
        return await sender.send(
            name or "", [AlertRecipient(name=c.name, phone=c.phone, email=c.email) for c in contacts], message
        )
    except AlertsNotConfigured as exc:
        raise AppError(
            503,
            "Emergency alerts are not set up. If you are in danger, call your local emergency number.",
            code="alerts_not_configured",
        ) from exc
