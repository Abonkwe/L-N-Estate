"""Rent payments, voiding, and bilingual receipt PDF generation."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from .. import schemas as s
from ..config import settings
from ..db import get_db
from ..deps import current_user
from ..receipts import render_receipt_pdf
from ..services import audit, commit, get_or_404, payment_out, record_payment

router = APIRouter(prefix="/payments", tags=["payments"], dependencies=[Depends(current_user)])


@router.post("", response_model=s.PaymentOut, status_code=status.HTTP_201_CREATED)
def create_payment(
    data: s.PaymentIn,
    db: Session = Depends(get_db),
    user: m.User = Depends(current_user),
) -> s.PaymentOut:
    """
    Record a rent payment (cash, bank, or Mobile Money) (FR-R1).
    - Automatically calculates the newly covered date period (covers_from, covers_to) (FR-R2).
    - Generates a sequential, non-reusable receipt record with remaining balance (reste) (BR-11, FR-R4).
    - Writes an entry to the audit log (FR-A3).
    """
    lease = get_or_404(db, m.Lease, data.lease_id, "Lease")
    return payment_out(record_payment(db, lease, data, user))


@router.get("", response_model=list[s.PaymentOut])
def list_payments(
    lease_id: int | None = Query(None, description="Filter payments by lease ID"),
    include_void: bool = Query(False, description="Whether to include voided payments"),
    limit: int = Query(200, ge=1, le=1000, description="Max payments to return"),
    db: Session = Depends(get_db),
) -> list[s.PaymentOut]:
    """List recorded payments, ordered by most recent first."""
    query = select(m.Payment).order_by(m.Payment.paid_on.desc(), m.Payment.id.desc()).limit(limit)
    if lease_id:
        query = query.where(m.Payment.lease_id == lease_id)
    if not include_void:
        query = query.where(m.Payment.is_void.is_(False))
    return [payment_out(p) for p in db.scalars(query)]


@router.post("/{payment_id}/void", response_model=s.PaymentOut)
def void_payment(
    payment_id: int,
    data: s.VoidIn,
    db: Session = Depends(get_db),
    user: m.User = Depends(current_user),
) -> s.PaymentOut:
    """
    Void a mistakenly entered payment with a mandatory reason (FR-R5).
    Payments are never physically deleted to maintain data integrity and ledger audit trail.
    """
    payment = get_or_404(db, m.Payment, payment_id, "Payment")
    if payment.is_void:
        raise HTTPException(status.HTTP_409_CONFLICT, "This payment is already void")

    payment.is_void = True
    payment.void_reason = data.reason
    payment.voided_by_id = user.id
    payment.voided_at = datetime.now(timezone.utc)

    audit(db, user, "payment.void", "payment", payment.id, {"reason": data.reason, "amount": payment.amount})
    commit(db)
    return payment_out(payment)


@router.get("/{payment_id}/receipt.pdf")
def get_receipt_pdf(payment_id: int, db: Session = Depends(get_db)) -> Response:
    """
    Generate and download the numbered bilingual PDF receipt (FR-R4).
    Lays out fields matching the physical receipt book (number, received from,
    amount in words & figures, purpose, amount paid, reste, place, date, signature).
    """
    payment = get_or_404(db, m.Payment, payment_id, "Payment")
    receipt = payment.receipt
    if not receipt:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No receipt found for this payment")

    tenant = payment.lease.tenant
    pdf = render_receipt_pdf(
        number=receipt.id,
        received_from=f"{tenant.title or ''} {tenant.full_name}".strip(),
        amount=payment.amount,
        purpose=receipt.purpose,
        balance=receipt.balance_remaining,
        place=receipt.place,
        on=receipt.issued_on,
        business_name=settings.business_name,
        is_void=payment.is_void,
    )
    return Response(
        pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="receipt-{receipt.id:05d}.pdf"'},
    )
