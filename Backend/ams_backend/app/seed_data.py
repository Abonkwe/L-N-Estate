"""Rich FAKE data for frontend development. DEV ONLY - never run this on real data.

    uv run python -m app.seed_data            # refuses if the database already has houses
    uv run python -m app.seed_data --reset    # wipes a SQLite dev database first, then seeds

Everything is dated relative to today, so every dashboard state is always present:
overdue, grace period, expiring soon, up to date, vacant units, a partial payment,
a voided payment, a rent increase, an adjustment, an ended lease with a deposit refund,
and expenses spread over several months for the monthly report.

Dev login created: dev@example.com / dev-password-123
"""
from __future__ import annotations

import argparse
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models as m
from . import schemas as s
from .billing import add_months
from .config import settings
from .db import SessionLocal, engine
from .security import hash_password
from .services import audit, lease_out, record_payment, today_local

DEV_EMAIL, DEV_PASSWORD = "abonkwe@gmail.com", "abo-password-123"

HOUSES = [("House 1", "Demo Street 1"), ("House 2", "Demo Street 2"), ("House 3", "Demo Street 3")]

UNITS = [  # house, label, type, description
    ("House 1", "A1", "apartment", "2 bedrooms, balcony"),
    ("House 1", "A2", "apartment", "2 bedrooms"),
    ("House 1", "A3", "studio", "Studio, ground floor"),
    ("House 1", "A4", "studio", "Studio, never let yet"),          # stays vacant
    ("House 2", "B1", "studio", "Studio"),
    ("House 2", "B2", "apartment", "3 bedrooms"),
    ("House 2", "B3", "apartment", "2 bedrooms"),
    ("House 3", "C1", "apartment", "2 bedrooms"),
    ("House 3", "C2", "apartment", "2 bedrooms, large living room"),
    ("House 3", "C3", "studio", "Studio, previous tenant moved out"),
]

TENANTS = {  # key: (title, full name)
    "A1": ("Mr", "Ngwa Collins"), "A2": ("Mrs", "Mbah Sylvie"), "A3": ("Mr", "Fon Peter"),
    "B1": ("Miss", "Achu Brenda"), "B2": ("Mr", "Tabe Emmanuel"), "B3": ("Mrs", "Nkeng Joyce"),
    "C1": ("Miss", "Fru Alice"), "C2": ("Mr", "Mbi Georges"), "C3": ("Mr", "Ako Daniel"),
}


def build(db: Session, today: date, user: m.User | None) -> None:
    """Create all demo data. `today` is a parameter so it can be tested for any date."""
    def mo(n: int) -> date:                      # first day of the month n months from now
        return add_months(today.replace(day=1), n)

    # lands the paid-through date 2 days ago, whatever today is -> "grace period"
    d = today - timedelta(days=1)
    grace_start = add_months(d.replace(day=min(d.day, 28)), -6)

    houses = {name: m.House(name=name, address=addr) for name, addr in HOUSES}
    units = {label: m.Unit(house=houses[h], label=label, unit_type=m.UnitType(kind), description=desc)
             for h, label, kind, desc in UNITS}
    tenants = {}
    for i, (key, (title, name)) in enumerate(TENANTS.items(), start=1):
        tenants[key] = m.Tenant(
            title=title, full_name=name, id_doc_type=m.IdDocType.nic, id_doc_number=f"DEV-ID-{i:04d}",
            id_issued_at="Buea", id_issued_on=date(2020, 1, 1), phone=f"+23760000{i:04d}",
            whatsapp_number=f"+23760000{i:04d}", next_of_kin_name=f"Demo Kin {i}",
            next_of_kin_phone=f"+23765000{i:04d}")
    db.add_all([*houses.values(), *units.values(), *tenants.values()])
    db.flush()

    events: list[tuple[date, m.Lease, int, m.PaymentMethod]] = []

    def lease(unit: str, start: date, base: int, water: int = 5_000, waste: int = 3_000) -> m.Lease:
        ls = m.Lease(unit_id=units[unit].id, tenant_id=tenants[unit].id, start_date=start,
                     end_date=add_months(start, 24), grace_days=5, deposit_amount=2 * base)
        ls.terms.append(m.LeaseTerm(effective_from=start, base_rent=base, water_fee=water, waste_fee=waste))
        db.add(ls)
        db.flush()
        return ls

    def pay_months(ls: m.Lease, months: int, offset: int, method: m.PaymentMethod) -> None:
        total = sum(t.base_rent + t.water_fee + t.waste_fee for t in ls.terms[:1])
        events.append((add_months(ls.start_date, offset), ls, months * total, method))

    bank, cash = m.PaymentMethod.bank, m.PaymentMethod.cash

    a1 = lease("A1", mo(-3), 105_000); pay_months(a1, 6, 0, bank)           # up to date
    a2 = lease("A2", mo(-8), 90_000); pay_months(a2, 6, 0, bank)            # overdue (~2 months)
    a3 = lease("A3", mo(-5), 70_000); pay_months(a3, 6, 0, cash)            # expiring soon (this month)
    b1 = lease("B1", grace_start, 88_000); pay_months(b1, 6, 0, bank)       # grace period
    b2 = lease("B2", mo(-7), 120_000)                                       # up to date, rent increase coming
    pay_months(b2, 6, 0, bank); pay_months(b2, 6, 5, cash)
    b2.terms.append(m.LeaseTerm(effective_from=add_months(b2.start_date, 12), base_rent=125_000,
                                water_fee=5_000, waste_fee=3_000, notice_given_on=add_months(b2.start_date, 6)))
    b3 = lease("B3", mo(-2), 65_000, waste=0)                               # overdue, with partial payments
    events.append((b3.start_date, b3, 40_000, bank))
    events.append((today, b3, 20_000, cash))
    c1 = lease("C1", mo(-1), 95_000); pay_months(c1, 4, 0, bank)            # only 4 months paid up front
    c2 = lease("C2", mo(-14), 75_000)                                       # long-standing, up to date
    pay_months(c2, 6, 0, bank); pay_months(c2, 6, 6, cash); pay_months(c2, 6, 12, bank)

    c3 = lease("C3", mo(-20), 75_000)                                       # ended lease (history)
    pay_months(c3, 6, 0, bank); pay_months(c3, 6, 6, bank); pay_months(c3, 6, 12, bank)

    db.commit()

    # record payments oldest-first so receipt numbers follow the dates
    for n, (paid_on, ls, amount, method) in enumerate(sorted(events, key=lambda e: e[0]), start=1):
        record_payment(db, ls, s.PaymentIn(
            lease_id=ls.id, paid_on=paid_on, amount=amount, method=method,
            reference=f"DEV-{n:03d}" if method == bank else None), user)
        db.expire_all()      # the lease's cached payment list is stale now; reload it next time

    # a mistaken duplicate payment, voided (shows the VOID receipt and the audit trail)
    dup = record_payment(db, c2, s.PaymentIn(
        lease_id=c2.id, paid_on=mo(-2) + timedelta(days=3), amount=498_000, method=bank), user)
    db.expire_all()
    dup.is_void, dup.void_reason = True, "Entered twice by mistake"
    dup.voided_by_id, dup.voided_at = (user.id if user else None), datetime.now(timezone.utc)
    audit(db, user, "payment.void", "payment", dup.id, {"reason": dup.void_reason, "amount": dup.amount})

    db.add(m.Adjustment(lease_id=c2.id, amount=10_000, reason="Goodwill credit for delayed tap repair",
                        adjusted_on=mo(-1), created_by_id=user.id if user else None))

    c3.status, c3.ended_on = m.LeaseStatus.ended, mo(-2)
    c3.deposit_refunded, c3.deposit_status = 100_000, m.DepositStatus.partially_refunded
    c3.deposit_notes = "Wall repair deducted from deposit"

    expenses = [  # house, unit, category, amount, date, description, paid to
        ("House 1", None, "repairs", 35_000, mo(-2) + timedelta(days=6), "Main water pipe repair", "Local plumber"),
        ("House 1", "A2", "maintenance", 12_000, mo(-1) + timedelta(days=3), "Repaint kitchen wall", "Painter"),
        ("House 1", None, "water_bill", 31_000, today, "Water bill", "Water company"),
        ("House 2", None, "water_bill", 28_500, mo(-1) + timedelta(days=9), "Water bill", "Water company"),
        ("House 2", "B3", "installation", 60_000, mo(-3) + timedelta(days=13), "New door lock and handle", "Hardware shop"),
        ("House 3", None, "tax", 45_000, mo(-1) + timedelta(days=4), "Council property tax", "Council"),
        ("House 3", "C2", "repairs", 18_000, today, "Fix leaking roof section", "Roofer"),
        ("House 3", "C3", "maintenance", 25_000, mo(-2) + timedelta(days=10), "Clean and repaint after move-out", "Painter"),
    ]
    for house, unit, cat, amount, when, desc, to in expenses:
        db.add(m.Expense(house_id=houses[house].id, unit_id=units[unit].id if unit else None,
                         category=m.ExpenseCategory(cat), amount=amount, incurred_on=when,
                         description=desc, paid_to=to, created_by_id=user.id if user else None))
    db.commit()
    db.expire_all()


def auto_seed_if_empty() -> bool:
    """Populates demo data on server startup if the database is currently empty."""
    with SessionLocal() as db:
        if db.scalar(select(m.House)):
            return False

        user = db.scalar(select(m.User).where(m.User.email == DEV_EMAIL))
        if not user:
            user = m.User(full_name="Dev User", email=DEV_EMAIL, password_hash=hash_password(DEV_PASSWORD))
            db.add(user)
            db.commit()

        build(db, today_local(), user)
        return True


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed FAKE development data")
    parser.add_argument("--reset", action="store_true", help="wipe a SQLite dev database first")
    args = parser.parse_args()

    print(f"Database: {settings.database_url}")
    if args.reset:
        if not settings.database_url.startswith("sqlite"):
            raise SystemExit("--reset only works on a SQLite dev database")
        m.Base.metadata.drop_all(engine)
    m.Base.metadata.create_all(engine)

    with SessionLocal() as db:
        if db.scalar(select(m.House)):
            raise SystemExit("This database already has houses. Use --reset on a SQLite dev database.")
        user = db.scalar(select(m.User).where(m.User.email == DEV_EMAIL))
        if not user:
            user = m.User(full_name="Dev User", email=DEV_EMAIL, password_hash=hash_password(DEV_PASSWORD))
            db.add(user)
            db.commit()
        build(db, today_local(), user)

        print("\nSeeded. Active leases:")
        for ls in db.scalars(select(m.Lease).where(m.Lease.status == m.LeaseStatus.active)):
            out = lease_out(ls)
            print(f"  {out.house_name} {out.unit_label:<3} {out.tenant_name:<16} {out.payment_status:<14} "
                  f"paid through {out.paid_through}")
        print(f"\nLogin: {DEV_EMAIL} / {DEV_PASSWORD}")


if __name__ == "__main__":
    main()

