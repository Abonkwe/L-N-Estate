"""
AMS billing logic - pure Python, no database needed, easy to unit test.

Core idea: we never store "paid through" or "balance". We store money in
(payments + adjustments) and the rent terms, then DERIVE the position:

    credit  = sum(non-void payments) + sum(adjustments)   # adjustments can be +/-
    month k = [start + k months, start + (k+1) months - 1 day]
    each month costs the monthly total of the term in effect at that month's start
    walk the months from the lease start, spending credit until it runs out

This handles 1, 3, 6 or any number of months paid at once, partial payments,
and rent increases (a new Term only affects months that begin on/after it).
All amounts are integer FCFA (XAF has no minor unit).
"""
from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Optional, Sequence

MAX_MONTHS = 600  # safety cap so a bad term can never loop forever


def add_months(d: date, months: int) -> date:
    """d + N months, clamping the day (31 Jan + 1 month = 28/29 Feb).
    Always call it from the lease START date to avoid day drift."""
    total = d.year * 12 + (d.month - 1) + months
    year, month0 = divmod(total, 12)
    month = month0 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


@dataclass(frozen=True)
class Term:
    """What a tenant is charged per month, from a given date onwards."""

    effective_from: date
    base_rent: int
    water_fee: int = 0   # added on top of the base rent
    waste_fee: int = 0   # waste management / security lighting, if charged

    @property
    def monthly_total(self) -> int:
        return self.base_rent + self.water_fee + self.waste_fee


def term_in_effect(terms: Sequence[Term], on: date) -> Term:
    """The latest term whose effective_from is on/before `on`
    (the first term applies even to dates before it)."""
    if not terms:
        raise ValueError("A lease needs at least one rent term")
    ordered = sorted(terms, key=lambda t: t.effective_from)
    current = ordered[0]
    for term in ordered:
        if term.effective_from <= on:
            current = term
        else:
            break
    return current


def _months_covered(start: date, terms: Sequence[Term], credit: int) -> tuple[int, int]:
    """Return (whole months covered, leftover credit)."""
    months, remaining = 0, credit
    while months < MAX_MONTHS:
        charge = term_in_effect(terms, add_months(start, months)).monthly_total
        if charge <= 0:
            raise ValueError("Monthly total must be greater than zero")
        if remaining < charge:
            break
        remaining -= charge
        months += 1
    return months, remaining


@dataclass(frozen=True)
class Position:
    months_paid: int
    paid_through: date            # last covered day (start - 1 day if nothing covered yet)
    next_period_start: date
    next_month_charge: int
    credit_toward_next: int       # money paid beyond the whole months covered
    shortfall_next: int           # still needed to cover the next month
    days_until_expiry: int        # negative once the paid period has run out
    is_overdue: bool              # past paid_through + grace days
    days_overdue: int


def compute_position(
    start_date: date,
    terms: Sequence[Term],
    total_credit: int,
    today: date,
    grace_days: int = 5,
) -> Position:
    months, leftover = _months_covered(start_date, terms, total_credit)
    paid_through = add_months(start_date, months) - timedelta(days=1)
    next_start = paid_through + timedelta(days=1)
    next_charge = term_in_effect(terms, next_start).monthly_total
    credit_next = max(leftover, 0)
    grace_ends = paid_through + timedelta(days=grace_days)
    overdue = today > grace_ends
    return Position(
        months_paid=months,
        paid_through=paid_through,
        next_period_start=next_start,
        next_month_charge=next_charge,
        credit_toward_next=credit_next,
        shortfall_next=max(next_charge - credit_next, 0),
        days_until_expiry=(paid_through - today).days,
        is_overdue=overdue,
        days_overdue=(today - grace_ends).days if overdue else 0,
    )


def payment_coverage(
    start_date: date,
    terms: Sequence[Term],
    credit_before: int,
    credit_after: int,
) -> Optional[tuple[date, date, int]]:
    """Which period did one payment newly cover? Used for the receipt
    ("Rents and utilities for Aug-Sept 2025") and the sheet's From/To columns.
    Returns (from, to, months) or None if it only added partial credit."""
    before, _ = _months_covered(start_date, terms, credit_before)
    after, _ = _months_covered(start_date, terms, credit_after)
    if after <= before:
        return None
    return (
        add_months(start_date, before),
        add_months(start_date, after) - timedelta(days=1),
        after - before,
    )
