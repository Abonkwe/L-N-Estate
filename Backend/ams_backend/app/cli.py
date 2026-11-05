"""Command line helpers.

  python -m app.cli create-user --name "Full Name" --email you@example.com
  python -m app.cli seed-demo        # FAKE data for development only
"""
import argparse
import getpass

from sqlalchemy import select

from . import models as m
from . import schemas as s
from .billing import add_months
from .db import SessionLocal, engine
from .security import hash_password
from .services import record_payment, today_local


def create_user(args) -> None:
    password = args.password or getpass.getpass("Password (min 8 chars): ")
    if len(password) < 8:
        raise SystemExit("Password must be at least 8 characters")
    m.Base.metadata.create_all(engine)
    with SessionLocal() as db:
        db.add(m.User(full_name=args.name, email=args.email.strip().lower(),
                      password_hash=hash_password(password), whatsapp_number=args.whatsapp))
        db.commit()
    print(f"User {args.email} created")


def seed_demo(_args) -> None:
    m.Base.metadata.create_all(engine)
    today = today_local()
    first = today.replace(day=1)
    with SessionLocal() as db:
        if db.scalar(select(m.House)):
            raise SystemExit("Database already has houses - refusing to seed")
        h1, h2 = m.House(name="Demo House 1", address="Demo street"), m.House(name="Demo House 2")
        units = {
            "A1": m.Unit(house=h1, label="A1", unit_type=m.UnitType.apartment, description="2 bedrooms"),
            "A2": m.Unit(house=h1, label="A2", unit_type=m.UnitType.apartment, description="2 bedrooms"),
            "A3": m.Unit(house=h1, label="A3", unit_type=m.UnitType.studio),   # stays vacant
            "B1": m.Unit(house=h2, label="B1", unit_type=m.UnitType.studio),
        }
        tenants = [m.Tenant(title="Mr", full_name=f"Demo Tenant {n}", phone=f"+2376000000{i}")
                   for i, n in enumerate(["One", "Two", "Three", "Four"])]
        db.add_all([h1, h2, *units.values(), *tenants])
        db.flush()

        # (unit, tenant, months ago it started, base rent, months paid up front)
        plan = [("A1", 0, 3, 105_000, 6), ("A2", 1, 8, 90_000, 6),
                ("B1", 2, 5, 70_000, 6), ("A3", 3, 2, 60_000, 0)]
        for label, ti, ago, rent, months in plan[:3]:
            lease = m.Lease(unit_id=units[label].id, tenant_id=tenants[ti].id,
                            start_date=add_months(first, -ago), grace_days=5, deposit_amount=2 * rent)
            lease.terms.append(m.LeaseTerm(effective_from=lease.start_date, base_rent=rent,
                                           water_fee=5_000, waste_fee=3_000))
            db.add(lease)
            db.flush()
            record_payment(db, lease, s.PaymentIn(
                lease_id=lease.id, paid_on=lease.start_date, amount=months * (rent + 8_000),
                method=m.PaymentMethod.bank, reference="DEMO"), None)
        print("Demo data loaded: 2 houses, 4 units (A3 vacant), 3 leases (up to date / expiring / overdue)")


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(required=True)
    p = sub.add_parser("create-user")
    p.add_argument("--name", required=True)
    p.add_argument("--email", required=True)
    p.add_argument("--password")
    p.add_argument("--whatsapp")
    p.set_defaults(func=create_user)
    sub.add_parser("seed-demo").set_defaults(func=seed_demo)
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
