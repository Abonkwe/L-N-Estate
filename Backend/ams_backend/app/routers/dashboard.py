"""Operational dashboard endpoints: lease payment urgency and vacancy tracking."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from .. import schemas as s
from ..db import get_db
from ..deps import current_user
from ..services import lease_out, today_local, unit_out

router = APIRouter(prefix="/dashboard", tags=["dashboard"], dependencies=[Depends(current_user)])

_STATUS_ORDER = {"overdue": 0, "grace": 1, "expiring_soon": 2, "up_to_date": 3}


@router.get("", response_model=s.Dashboard)
def get_dashboard(
    expiring_days: int = Query(30, ge=1, le=365, description="Days threshold to mark lease as expiring soon"),
    db: Session = Depends(get_db),
) -> s.Dashboard:
    """
    Overview of all active leases categorized by urgency (FR-D1):
    - Overdue (past 5-day grace period)
    - In grace period (within 5 days after paid period)
    - Expiring soon (within chosen expiring_days threshold)
    - Up to date
    Also lists all currently vacant units (FR-D3).
    """
    today = today_local()
    leases = [
        lease_out(l, today, expiring_days)
        for l in db.scalars(select(m.Lease).where(m.Lease.status == m.LeaseStatus.active))
    ]
    # Sort by highest urgency first, then by earliest paid_through date
    leases.sort(key=lambda l: (_STATUS_ORDER.get(l.payment_status, 9), l.paid_through))

    vacant = [u for u in (unit_out(u) for u in db.scalars(select(m.Unit))) if not u.is_occupied]
    counts = s.DashboardCounts(vacant_units=len(vacant))
    for l in leases:
        setattr(counts, l.payment_status, getattr(counts, l.payment_status) + 1)

    return s.Dashboard(counts=counts, leases=leases, vacant_units=vacant)
