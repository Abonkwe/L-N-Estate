"""Financial reporting endpoints."""
import calendar
from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from .. import schemas as s
from ..db import get_db
from ..deps import current_user

router = APIRouter(prefix="/reports", tags=["reports"], dependencies=[Depends(current_user)])


@router.get("/monthly", response_model=s.MonthlyReport)
def get_monthly_report(
    year: int = Query(ge=2000, le=2100, description="Report calendar year"),
    month: int = Query(ge=1, le=12, description="Report calendar month (1-12)"),
    db: Session = Depends(get_db),
) -> s.MonthlyReport:
    """
    Monthly financial performance summary (FR-D4):
    - Total income, total expenses, and net profit
    - Income and expenses broken down by house
    - Expenses categorized by type (repairs, maintenance, water bill, etc.)
    """
    first_day = date(year, month, 1)
    last_day = date(year, month, calendar.monthrange(year, month)[1])

    income = defaultdict(int)
    spent = defaultdict(int)
    by_category: dict[str, int] = defaultdict(int)

    # Collect valid (non-void) income
    payments_query = select(m.Payment).where(
        m.Payment.is_void.is_(False),
        m.Payment.paid_on >= first_day,
        m.Payment.paid_on <= last_day,
    )
    for p in db.scalars(payments_query):
        income[p.lease.unit.house_id] += p.amount

    # Collect expenses
    expenses_query = select(m.Expense).where(
        m.Expense.incurred_on >= first_day,
        m.Expense.incurred_on <= last_day,
    )
    for e in db.scalars(expenses_query):
        spent[e.house_id] += e.amount
        by_category[e.category.value] += e.amount

    # Group by house
    houses = list(db.scalars(select(m.House).order_by(m.House.name)))
    rows = [
        s.HouseMonth(
            house_id=h.id,
            house_name=h.name,
            income=income[h.id],
            expenses=spent[h.id],
            net=income[h.id] - spent[h.id],
        )
        for h in houses
    ]

    total_in = sum(r.income for r in rows)
    total_out = sum(r.expenses for r in rows)

    return s.MonthlyReport(
        year=year,
        month=month,
        income=total_in,
        expenses=total_out,
        net=total_in - total_out,
        by_house=rows,
        expenses_by_category=dict(by_category),
    )

