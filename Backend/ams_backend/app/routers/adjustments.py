"""Financial adjustments endpoints: discounts, waivers, and corrections."""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from .. import models as m
from .. import schemas as s
from ..db import get_db
from ..deps import current_user
from ..services import audit, commit, get_or_404

router = APIRouter(prefix="/adjustments", tags=["adjustments"], dependencies=[Depends(current_user)])


@router.post("", response_model=s.AdjustmentOut, status_code=status.HTTP_201_CREATED)
def create_adjustment(
    data: s.AdjustmentIn,
    db: Session = Depends(get_db),
    user: m.User = Depends(current_user),
) -> s.AdjustmentOut:
    """
    Record a financial adjustment on a lease (FR-R6).
    - Positive amount = credit to the tenant (e.g., discount, waiver, opening balance).
    - Negative amount = extra charge (e.g., damages, in-lieu fees).
    - Automatically updates the derived paid-through balance.
    """
    lease = get_or_404(db, m.Lease, data.lease_id, "Lease")
    adj = m.Adjustment(
        lease_id=lease.id,
        amount=data.amount,
        reason=data.reason,
        adjusted_on=data.adjusted_on,
        created_by_id=user.id,
    )
    db.add(adj)
    db.flush()
    audit(db, user, "adjustment.create", "adjustment", adj.id, data.model_dump())
    commit(db)
    return adj

