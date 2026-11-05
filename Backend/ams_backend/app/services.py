"""Business logic shared by the API routes (and later the WhatsApp assistant)."""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import billing
from . import models as m
from . import schemas as s
from .config import settings


def today_local() -> date:
    try:
        return datetime.now(ZoneInfo(settings.timezone)).date()
    except Exception:
        # Fallback to UTC+1 (Douala / WAT timezone without DST) if tzdata is missing on Windows
        return datetime.now(timezone(timedelta(hours=1))).date()


# ---------- small helpers ----------
def get_or_404(db: Session, model, obj_id: int, name: str):
    obj = db.get(model, obj_id)
    if obj is None:
        raise HTTPException(404, f"{name} {obj_id} not found")
    return obj


def commit(db: Session, conflict_msg: str = "This conflicts with existing data") -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, conflict_msg) from exc


def audit(db: Session, user: m.User | None, action: str, entity_type: str,
          entity_id: int | None, changes: dict | None = None, source: str = "web") -> None:
    db.add(m.AuditLog(
        user_id=user.id if user else None, source=source, action=action,
        entity_type=entity_type, entity_id=entity_id,
        changes=jsonable_encoder(changes) if changes else None,
    ))


# ---------- leases: derived position ----------
def lease_terms(lease: m.Lease) -> list[billing.Term]:
    return [billing.Term(t.effective_from, t.base_rent, t.water_fee, t.waste_fee) for t in lease.terms]


def lease_credit(lease: m.Lease) -> int:
    """Money in: non-void payments plus adjustments (+credit / -charge)."""
    paid = sum(p.amount for p in lease.payments if not p.is_void)
    return paid + sum(a.amount for a in lease.adjustments)


def classify(lease: m.Lease, pos: billing.Position, expiring_days: int) -> str:
    if lease.status != m.LeaseStatus.active:
        return "ended"
    if pos.is_overdue:
        return "overdue"
    if pos.days_until_expiry < 0:
        return "grace"
    if pos.days_until_expiry <= expiring_days:
        return "expiring_soon"
    return "up_to_date"


def lease_out(lease: m.Lease, today: date | None = None, expiring_days: int = 30) -> s.LeaseOut:
    today = today or today_local()
    terms = lease_terms(lease)
    pos = billing.compute_position(lease.start_date, terms, lease_credit(lease), today, lease.grace_days)
    cur = billing.term_in_effect(terms, today)
    unit, tenant = lease.unit, lease.tenant
    return s.LeaseOut(
        id=lease.id, status=lease.status, unit_id=unit.id, unit_label=unit.label,
        house_id=unit.house_id, house_name=unit.house.name,
        tenant_id=tenant.id, tenant_name=tenant.full_name, tenant_phone=tenant.phone,
        start_date=lease.start_date, end_date=lease.end_date, grace_days=lease.grace_days,
        base_rent=cur.base_rent, water_fee=cur.water_fee, waste_fee=cur.waste_fee,
        monthly_total=cur.monthly_total,
        months_paid=pos.months_paid, paid_through=pos.paid_through,
        next_period_start=pos.next_period_start, next_month_charge=pos.next_month_charge,
        credit_toward_next=pos.credit_toward_next, shortfall_next=pos.shortfall_next,
        days_until_expiry=pos.days_until_expiry, days_overdue=pos.days_overdue,
        payment_status=classify(lease, pos, expiring_days),
        deposit_amount=lease.deposit_amount, deposit_status=lease.deposit_status,
        deposit_refunded=lease.deposit_refunded, notes=lease.notes,
    )


def term_out(t: m.LeaseTerm) -> s.TermOut:
    return s.TermOut(id=t.id, effective_from=t.effective_from, base_rent=t.base_rent,
                     water_fee=t.water_fee, waste_fee=t.waste_fee, notice_given_on=t.notice_given_on,
                     monthly_total=t.base_rent + t.water_fee + t.waste_fee)


def lease_detail(lease: m.Lease) -> s.LeaseDetail:
    return s.LeaseDetail(**lease_out(lease).model_dump(), terms=[term_out(t) for t in lease.terms])


# ---------- houses / units ----------
def unit_out(unit: m.Unit) -> s.UnitOut:
    active = next((l for l in unit.leases if l.status == m.LeaseStatus.active), None)
    return s.UnitOut(
        id=unit.id, house_id=unit.house_id, house_name=unit.house.name, label=unit.label,
        unit_type=unit.unit_type, description=unit.description, listed_rent=unit.listed_rent,
        is_occupied=active is not None, lease_id=active.id if active else None,
        tenant_name=active.tenant.full_name if active else None,
    )


def house_out(house: m.House) -> s.HouseOut:
    occupied = sum(1 for u in house.units if any(l.status == m.LeaseStatus.active for l in u.leases))
    return s.HouseOut(id=house.id, name=house.name, address=house.address, notes=house.notes,
                      unit_count=len(house.units), occupied_count=occupied)


# ---------- payments ----------
def describe_period(cov: tuple[date, date, int] | None) -> str:
    if not cov:
        return "Part payment of rents and utilities"
    a, b, _ = cov
    if (a.year, a.month) == (b.year, b.month):
        return f"Rents and utilities for {a:%b %Y}"
    if a.year == b.year:
        return f"Rents and utilities for {a:%b}-{b:%b %Y}"
    return f"Rents and utilities for {a:%b %Y}-{b:%b %Y}"


def payment_out(p: m.Payment) -> s.PaymentOut:
    lease = p.lease
    return s.PaymentOut(
        id=p.id, lease_id=p.lease_id, tenant_name=lease.tenant.full_name,
        unit_label=lease.unit.label, house_name=lease.unit.house.name,
        paid_on=p.paid_on, amount=p.amount, method=p.method, reference=p.reference, note=p.note,
        covers_from=p.covers_from, covers_to=p.covers_to, is_void=p.is_void, void_reason=p.void_reason,
        receipt_id=p.receipt.id if p.receipt else None,
        balance_remaining=p.receipt.balance_remaining if p.receipt else None,
    )


def preview_payment_effect(lease: m.Lease, data: s.PaymentIn) -> s.PaymentPreview:
    terms = lease_terms(lease)
    before = lease_credit(lease)
    after = before + data.amount
    cov = billing.payment_coverage(lease.start_date, terms, before, after)
    pos = billing.compute_position(lease.start_date, terms, after, data.paid_on, lease.grace_days)
    return s.PaymentPreview(
        covers_from=cov[0] if cov else None, covers_to=cov[1] if cov else None,
        months_covered=cov[2] if cov else 0, paid_through_after=pos.paid_through,
        credit_toward_next_after=pos.credit_toward_next, shortfall_next_after=pos.shortfall_next,
        balance_remaining=pos.shortfall_next if pos.paid_through < data.paid_on else 0,
        purpose=describe_period(cov),
    )


def record_payment(db: Session, lease: m.Lease, data: s.PaymentIn, user: m.User | None,
                   source: str = "web") -> m.Payment:
    terms = lease_terms(lease)
    before = lease_credit(lease)
    after = before + data.amount
    cov = billing.payment_coverage(lease.start_date, terms, before, after)

    payment = m.Payment(
        lease_id=lease.id, paid_on=data.paid_on, amount=data.amount, method=data.method,
        reference=data.reference, note=data.note, received_by_id=user.id if user else None,
        covers_from=cov[0] if cov else None, covers_to=cov[1] if cov else None,
    )
    db.add(payment)
    db.flush()

    pos = billing.compute_position(lease.start_date, terms, after, data.paid_on, lease.grace_days)
    # "Reste": what is still owed for a month that has already begun
    reste = pos.shortfall_next if pos.paid_through < data.paid_on else 0
    db.add(m.Receipt(payment_id=payment.id, issued_on=data.paid_on,
                     purpose=describe_period(cov), balance_remaining=reste,
                     place=settings.receipt_place))
    audit(db, user, "payment.create", "payment", payment.id,
          {"lease_id": lease.id, "amount": data.amount, "method": data.method.value}, source)
    commit(db)
    db.refresh(payment)
    return payment


def rent_sheet(lease: m.Lease) -> list[s.RentSheetRow]:
    """Rebuilt from the ledger every time, so it stays correct after voids/adjustments."""
    terms = lease_terms(lease)
    events = [(p.paid_on, 0, p.id, p) for p in lease.payments if not p.is_void]
    events += [(a.adjusted_on, 1, a.id, a) for a in lease.adjustments]
    events.sort(key=lambda e: (e[0], e[1], e[2]))
    credit, rows = 0, []
    for _, _, _, obj in events:
        if isinstance(obj, m.Adjustment):
            credit += obj.amount
            continue
        before, credit = credit, credit + obj.amount
        cov = billing.payment_coverage(lease.start_date, terms, before, credit)
        rows.append(s.RentSheetRow(
            sn=len(rows) + 1, paid_on=obj.paid_on, amount=obj.amount,
            period_from=cov[0] if cov else None, period_to=cov[1] if cov else None,
            comment=obj.note or (None if cov else "Part payment"),
            receipt_id=obj.receipt.id if obj.receipt else None,
        ))
    return rows
