"""Lease management endpoints: contracts, rent terms, renewals, and rent sheets."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from .. import schemas as s
from ..db import get_db
from ..deps import current_user
from ..services import (
    audit, commit, get_or_404, lease_detail, lease_out, rent_sheet, term_out
)

router = APIRouter(prefix="/leases", tags=["leases"], dependencies=[Depends(current_user)])


@router.post("", response_model=s.LeaseDetail, status_code=status.HTTP_201_CREATED)
def create_lease(
    data: s.LeaseIn,
    db: Session = Depends(get_db),
    user: m.User = Depends(current_user),
) -> s.LeaseDetail:
    """
    Create a lease linking a tenant to a unit.
    - Caution deposit is automatically set to exactly 2 months of base rent (BR-6).
    - Initial rent term is created with negotiated base rent, water fee, and waste fee (BR-1, BR-2).
    - Ensures only one active lease can exist per unit (FR-L2).
    """
    unit = get_or_404(db, m.Unit, data.unit_id, "Unit")
    get_or_404(db, m.Tenant, data.tenant_id, "Tenant")

    if any(l.status == m.LeaseStatus.active for l in unit.leases):
        raise HTTPException(status.HTTP_409_CONFLICT, "This unit already has an active lease")
    if data.end_date and data.end_date <= data.start_date:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "end_date must be after start_date")

    lease = m.Lease(
        unit_id=data.unit_id,
        tenant_id=data.tenant_id,
        start_date=data.start_date,
        end_date=data.end_date,
        grace_days=data.grace_days,
        notes=data.notes,
        deposit_amount=2 * data.base_rent,
    )
    lease.terms.append(
        m.LeaseTerm(
            effective_from=data.start_date,
            base_rent=data.base_rent,
            water_fee=data.water_fee,
            waste_fee=data.waste_fee,
        )
    )
    db.add(lease)
    db.flush()
    audit(db, user, "lease.create", "lease", lease.id, data.model_dump())
    commit(db, "This unit already has an active lease")
    return lease_detail(lease)


@router.get("", response_model=list[s.LeaseOut])
def list_leases(
    status: m.LeaseStatus | None = Query(None, description="Filter leases by status (active/ended/terminated)"),
    tenant_id: int | None = Query(None, description="Filter leases by tenant ID"),
    unit_id: int | None = Query(None, description="Filter leases by unit ID"),
    db: Session = Depends(get_db),
) -> list[s.LeaseOut]:
    """List leases with their dynamically derived financial position."""
    query = select(m.Lease).order_by(m.Lease.start_date.desc())
    if status:
        query = query.where(m.Lease.status == status)
    if tenant_id:
        query = query.where(m.Lease.tenant_id == tenant_id)
    if unit_id:
        query = query.where(m.Lease.unit_id == unit_id)
    return [lease_out(l) for l in db.scalars(query)]


@router.get("/{lease_id}", response_model=s.LeaseDetail)
def get_lease(lease_id: int, db: Session = Depends(get_db)) -> s.LeaseDetail:
    """Retrieve full lease details, rent history terms, and derived financial position."""
    return lease_detail(get_or_404(db, m.Lease, lease_id, "Lease"))


@router.post("/{lease_id}/terms", response_model=s.TermOut, status_code=status.HTTP_201_CREATED)
def add_rent_term(
    lease_id: int,
    data: s.TermIn,
    db: Session = Depends(get_db),
    user: m.User = Depends(current_user),
) -> s.TermOut:
    """
    Record a rent change (increase or decrease) (BR-7, FR-L4).
    Earlier paid months preserve their historical rent; the new term applies from `effective_from`.
    """
    lease = get_or_404(db, m.Lease, lease_id, "Lease")
    term = m.LeaseTerm(lease_id=lease.id, **data.model_dump())
    db.add(term)
    db.flush()
    audit(db, user, "lease.rent_change", "lease", lease.id, data.model_dump())
    commit(db, "A rent term already starts on that date")
    return term_out(term)


@router.post("/{lease_id}/end", response_model=s.LeaseDetail)
def end_lease(
    lease_id: int,
    data: s.LeaseEnd,
    db: Session = Depends(get_db),
    user: m.User = Depends(current_user),
) -> s.LeaseDetail:
    """
    End or terminate a lease (FR-L5).
    Releases the unit vacancy, records termination date, deposit refund, and notes.
    """
    lease = get_or_404(db, m.Lease, lease_id, "Lease")
    if lease.status != m.LeaseStatus.active:
        raise HTTPException(status.HTTP_409_CONFLICT, "This lease has already ended")
    if data.deposit_refunded > lease.deposit_amount:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Refund cannot exceed the deposit")

    lease.status = m.LeaseStatus(data.status)
    lease.ended_on = data.ended_on
    lease.deposit_refunded = data.deposit_refunded
    if data.notes:
        lease.deposit_notes = data.notes
    if data.deposit_status:
        lease.deposit_status = data.deposit_status
    elif data.deposit_refunded >= lease.deposit_amount:
        lease.deposit_status = m.DepositStatus.refunded
    elif data.deposit_refunded > 0:
        lease.deposit_status = m.DepositStatus.partially_refunded

    audit(db, user, "lease.end", "lease", lease.id, data.model_dump())
    commit(db)
    return lease_detail(lease)


@router.get("/{lease_id}/rent-sheet", response_model=list[s.RentSheetRow])
def get_rent_sheet(lease_id: int, db: Session = Depends(get_db)) -> list[s.RentSheetRow]:
    """
    Generate the per-tenant rent sheet reproducing the Word 'Rents Monitoring Sheet' (FR-D2).
    Includes payment serial number, date, amount, duration covered from/to, and comments.
    """
    return rent_sheet(get_or_404(db, m.Lease, lease_id, "Lease"))
