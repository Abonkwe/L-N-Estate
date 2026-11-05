"""Expense tracking endpoints linked to houses and units."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from .. import schemas as s
from ..db import get_db
from ..deps import current_user
from ..services import audit, commit, get_or_404

router = APIRouter(prefix="/expenses", tags=["expenses"], dependencies=[Depends(current_user)])


def _format_expense(e: m.Expense, db: Session) -> s.ExpenseOut:
    house = db.get(m.House, e.house_id)
    return s.ExpenseOut(
        id=e.id,
        house_id=e.house_id,
        house_name=house.name if house else "Unknown",
        unit_id=e.unit_id,
        category=e.category,
        amount=e.amount,
        incurred_on=e.incurred_on,
        description=e.description,
        paid_to=e.paid_to,
    )


def _validate_unit_in_house(db: Session, house_id: int, unit_id: int | None) -> None:
    if unit_id is not None:
        unit = get_or_404(db, m.Unit, unit_id, "Unit")
        if unit.house_id != house_id:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, "That unit does not belong to this house"
            )


@router.post("", response_model=s.ExpenseOut, status_code=status.HTTP_201_CREATED)
def create_expense(
    data: s.ExpenseIn,
    db: Session = Depends(get_db),
    user: m.User = Depends(current_user),
) -> s.ExpenseOut:
    """
    Record an operational expense (repairs, maintenance, water bill, taxes, etc.) (FR-E1).
    Can be assigned to an entire house (unit_id=null) or to a specific unit.
    """
    get_or_404(db, m.House, data.house_id, "House")
    _validate_unit_in_house(db, data.house_id, data.unit_id)

    expense = m.Expense(**data.model_dump(), created_by_id=user.id)
    db.add(expense)
    db.flush()
    audit(db, user, "expense.create", "expense", expense.id, data.model_dump())
    commit(db)
    return _format_expense(expense, db)


@router.get("", response_model=list[s.ExpenseOut])
def list_expenses(
    house_id: int | None = Query(None, description="Filter expenses by house ID"),
    category: m.ExpenseCategory | None = Query(None, description="Filter by category"),
    date_from: date | None = Query(None, description="Filter expenses on/after date"),
    date_to: date | None = Query(None, description="Filter expenses on/before date"),
    db: Session = Depends(get_db),
) -> list[s.ExpenseOut]:
    """List and filter expenses by house, category, and date range (FR-E2)."""
    query = select(m.Expense).order_by(m.Expense.incurred_on.desc(), m.Expense.id.desc())
    if house_id:
        query = query.where(m.Expense.house_id == house_id)
    if category:
        query = query.where(m.Expense.category == category)
    if date_from:
        query = query.where(m.Expense.incurred_on >= date_from)
    if date_to:
        query = query.where(m.Expense.incurred_on <= date_to)
    return [_format_expense(e, db) for e in db.scalars(query)]


@router.patch("/{expense_id}", response_model=s.ExpenseOut)
def update_expense(
    expense_id: int,
    data: s.ExpensePatch,
    db: Session = Depends(get_db),
    user: m.User = Depends(current_user),
) -> s.ExpenseOut:
    """Update details of a recorded expense."""
    expense = get_or_404(db, m.Expense, expense_id, "Expense")
    changes = data.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(expense, key, value)
    _validate_unit_in_house(db, expense.house_id, expense.unit_id)
    audit(db, user, "expense.update", "expense", expense.id, changes)
    commit(db)
    return _format_expense(expense, db)
