from datetime import date

from app.billing import Term, add_months, compute_position, payment_coverage

START = date(2026, 1, 1)
# contract example: 105,000 rent + 5,000 water + 3,000 waste/lighting = 113,000
TERM = Term(START, base_rent=105_000, water_fee=5_000, waste_fee=3_000)


def test_add_months_clamps_day():
    assert add_months(date(2026, 1, 31), 1) == date(2026, 2, 28)
    assert add_months(date(2026, 1, 31), 13) == date(2027, 2, 28)


def test_six_months_advance():
    p = compute_position(START, [TERM], 6 * 113_000, today=date(2026, 3, 1))
    assert p.months_paid == 6
    assert p.paid_through == date(2026, 6, 30)
    assert not p.is_overdue and p.days_until_expiry > 0


def test_partial_payment_shows_shortfall():
    p = compute_position(START, [TERM], 6 * 113_000 + 100_000, today=date(2026, 3, 1))
    assert p.months_paid == 6
    assert p.credit_toward_next == 100_000
    assert p.shortfall_next == 13_000


def test_grace_period_is_five_days():
    credit = 6 * 113_000
    assert not compute_position(START, [TERM], credit, date(2026, 7, 5)).is_overdue
    late = compute_position(START, [TERM], credit, date(2026, 7, 6))
    assert late.is_overdue and late.days_overdue == 1


def test_rent_increase_applies_only_to_new_months():
    raised = Term(date(2026, 7, 1), 115_000, 5_000, 3_000)  # 123,000 from July
    p = compute_position(START, [TERM, raised], 6 * 113_000 + 100_000, date(2026, 8, 1))
    assert p.paid_through == date(2026, 6, 30)       # old months stay at old price
    assert p.next_month_charge == 123_000
    assert p.shortfall_next == 23_000


def test_receipt_period_for_two_month_payment():
    # illustrative: 150,000 against 75,000/month (e.g. 70,000 rent + 5,000 water)
    t = Term(date(2025, 8, 1), 70_000, 5_000)
    frm, to, months = payment_coverage(date(2025, 8, 1), [t], 0, 150_000)
    assert (frm, to, months) == (date(2025, 8, 1), date(2025, 9, 30), 2)


def test_partial_then_topup_covers_period():
    assert payment_coverage(START, [TERM], 0, 50_000) is None
    frm, to, months = payment_coverage(START, [TERM], 50_000, 113_000)
    assert (frm, to, months) == (date(2026, 1, 1), date(2026, 1, 31), 1)


def test_nothing_paid_yet():
    p = compute_position(START, [TERM], 0, date(2026, 1, 3))
    assert p.months_paid == 0 and p.paid_through == date(2025, 12, 31)
