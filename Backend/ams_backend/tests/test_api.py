from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.billing import add_months
from app.db import enable_sqlite_fk, get_db
from app.main import app
from app.models import Base, User
from app.security import hash_password
from app.services import today_local


@pytest.fixture()
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    enable_sqlite_fk(engine)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override
    with Session() as db:
        db.add(User(full_name="Test User", email="t@example.com", password_hash=hash_password("password123")))
        db.commit()
    c = TestClient(app)
    token = c.post("/auth/login", data={"username": "t@example.com", "password": "password123"}).json()["access_token"]
    c.headers["Authorization"] = f"Bearer {token}"
    yield c
    app.dependency_overrides.clear()


def setup_lease(c, start, label="A1", rent=105_000, tenant="Test Tenant", house_id=None):
    if house_id is None:
        house_id = c.post("/houses", json={"name": "House 1"}).json()["id"]
    unit = c.post("/units", json={"house_id": house_id, "label": label}).json()
    ten = c.post("/tenants", json={"full_name": tenant, "title": "Mr"}).json()
    r = c.post("/leases", json={"unit_id": unit["id"], "tenant_id": ten["id"], "start_date": start.isoformat(),
                                "base_rent": rent, "water_fee": 5_000, "waste_fee": 3_000})
    assert r.status_code == 201, r.text
    return house_id, unit, r.json()


def pay(c, lease_id, amount, on=None, method="bank"):
    r = c.post("/payments", json={"lease_id": lease_id, "paid_on": (on or today_local()).isoformat(),
                                  "amount": amount, "method": method})
    assert r.status_code == 201, r.text
    return r.json()


def test_requires_login():
    assert TestClient(app).get("/houses").status_code == 401


def test_wrong_password(client):
    r = TestClient(app).post("/auth/login", data={"username": "t@example.com", "password": "nope"})
    assert r.status_code == 401


def test_lease_deposit_and_six_month_payment(client):
    start = add_months(today_local().replace(day=1), -2)
    _, _, lease = setup_lease(client, start)
    assert lease["monthly_total"] == 113_000
    assert lease["deposit_amount"] == 210_000                  # exactly 2 months of base rent
    assert lease["payment_status"] == "overdue"                # nothing paid yet

    p = pay(client, lease["id"], 6 * 113_000, on=start)
    assert p["receipt_id"] == 1 and p["balance_remaining"] == 0
    assert p["covers_from"] == start.isoformat()

    d = client.get(f"/leases/{lease['id']}").json()
    assert d["months_paid"] == 6
    assert d["paid_through"] == (add_months(start, 6) - timedelta(days=1)).isoformat()
    assert d["payment_status"] == "up_to_date"


def test_partial_payment_and_reste(client):
    start = add_months(today_local().replace(day=1), -1)
    _, _, lease = setup_lease(client, start)
    p = pay(client, lease["id"], 50_000, on=start)
    assert p["covers_from"] is None and p["balance_remaining"] == 63_000
    d = client.get(f"/leases/{lease['id']}").json()
    assert d["credit_toward_next"] == 50_000 and d["shortfall_next"] == 63_000
    sheet = client.get(f"/leases/{lease['id']}/rent-sheet").json()
    assert sheet[0]["comment"] == "Part payment"


def test_receipts_are_sequential_and_pdf(client):
    start = add_months(today_local().replace(day=1), -1)
    _, _, lease = setup_lease(client, start)
    p1, p2 = pay(client, lease["id"], 113_000, on=start), pay(client, lease["id"], 113_000)
    assert (p1["receipt_id"], p2["receipt_id"]) == (1, 2)
    r = client.get(f"/payments/{p1['id']}/receipt.pdf")
    assert r.status_code == 200 and r.content[:4] == b"%PDF"


def test_void_reverses_position_and_is_audited(client):
    start = add_months(today_local().replace(day=1), -1)
    _, _, lease = setup_lease(client, start)
    p = pay(client, lease["id"], 6 * 113_000, on=start)
    assert client.post(f"/payments/{p['id']}/void", json={"reason": "x"}).status_code == 422
    assert client.post(f"/payments/{p['id']}/void", json={"reason": "Entered twice"}).status_code == 200
    assert client.post(f"/payments/{p['id']}/void", json={"reason": "again"}).status_code == 409
    assert client.get(f"/leases/{lease['id']}").json()["months_paid"] == 0
    assert client.get(f"/payments?lease_id={lease['id']}").json() == []
    assert len(client.get(f"/payments?lease_id={lease['id']}&include_void=true").json()) == 1


def test_rent_increase_applies_to_new_months_only(client):
    start = add_months(today_local().replace(day=1), -1)
    _, _, lease = setup_lease(client, start)
    pay(client, lease["id"], 6 * 113_000, on=start)
    effective = add_months(start, 6)
    r = client.post(f"/leases/{lease['id']}/terms", json={
        "effective_from": effective.isoformat(), "base_rent": 115_000,
        "water_fee": 5_000, "waste_fee": 3_000, "notice_given_on": start.isoformat()})
    assert r.status_code == 201 and r.json()["monthly_total"] == 123_000
    d = client.get(f"/leases/{lease['id']}").json()
    assert d["months_paid"] == 6 and d["next_month_charge"] == 123_000


def test_one_active_lease_per_unit(client):
    start = add_months(today_local().replace(day=1), -1)
    _, unit, _ = setup_lease(client, start)
    t2 = client.post("/tenants", json={"full_name": "Second Tenant"}).json()
    r = client.post("/leases", json={"unit_id": unit["id"], "tenant_id": t2["id"],
                                     "start_date": start.isoformat(), "base_rent": 90_000})
    assert r.status_code == 409


def test_end_lease_frees_unit_and_records_refund(client):
    start = add_months(today_local().replace(day=1), -1)
    _, unit, lease = setup_lease(client, start)
    r = client.post(f"/leases/{lease['id']}/end", json={
        "status": "ended", "ended_on": today_local().isoformat(), "deposit_refunded": 200_000})
    assert r.status_code == 200 and r.json()["deposit_status"] == "partially_refunded"
    assert client.get(f"/units/{unit['id']}").json()["is_occupied"] is False


def test_dashboard_statuses_and_vacant_units(client):
    first = today_local().replace(day=1)
    h, _, lease1 = setup_lease(client, add_months(first, -2), label="A1", tenant="Paid Up")
    pay(client, lease1["id"], 6 * 113_000, on=add_months(first, -2))
    setup_lease(client, add_months(first, -3), label="A2", tenant="Late Payer", house_id=h)
    client.post("/units", json={"house_id": h, "label": "A3"})
    d = client.get("/dashboard").json()
    assert d["counts"]["up_to_date"] == 1 and d["counts"]["overdue"] == 1
    assert d["counts"]["vacant_units"] == 1
    assert d["leases"][0]["tenant_name"] == "Late Payer"       # overdue sorted first


def test_expenses_and_monthly_report(client):
    start = add_months(today_local().replace(day=1), -1)
    h, _, lease = setup_lease(client, start)
    pay(client, lease["id"], 113_000)
    pay(client, lease["id"], 113_000, method="cash")
    e = client.post("/expenses", json={"house_id": h, "category": "repairs", "amount": 40_000,
                                       "incurred_on": today_local().isoformat()})
    assert e.status_code == 201
    t = today_local()
    rep = client.get(f"/reports/monthly?year={t.year}&month={t.month}").json()
    assert (rep["income"], rep["expenses"], rep["net"]) == (226_000, 40_000, 186_000)
    assert rep["expenses_by_category"] == {"repairs": 40_000}


def test_adjustment_counts_as_credit(client):
    start = add_months(today_local().replace(day=1), -1)
    _, _, lease = setup_lease(client, start)
    client.post("/adjustments", json={"lease_id": lease["id"], "amount": 113_000,
                                      "reason": "Negotiated free month", "adjusted_on": start.isoformat()})
    assert client.get(f"/leases/{lease['id']}").json()["months_paid"] == 1


def test_audit_log_endpoint(client):
    client.post("/houses", json={"name": "Audit House"})
    res = client.get("/audit-log")
    assert res.status_code == 200
    logs = res.json()
    assert isinstance(logs, list)
    assert len(logs) > 0
    assert logs[0]["action"] == "house.create"
    assert logs[0]["entity_type"] == "house"
    assert "at" in logs[0]

