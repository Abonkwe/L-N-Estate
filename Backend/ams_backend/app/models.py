"""
AMS database models - SQLAlchemy 2.0. Works on PostgreSQL (production)
and SQLite (local dev).

Design rules:
  * Money is integer FCFA. No floats, no decimals.
  * Nothing financial is ever deleted: payments are VOIDED (with a reason),
    and every change is written to AuditLog (source = web / whatsapp / system).
  * "Paid through" and balances are NOT stored - see billing.py.
  * Rent history lives in LeaseTerm, so a rent increase is a new row, not an edit.
"""
from __future__ import annotations

import enum
from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    JSON, Boolean, CheckConstraint, Date, DateTime, Enum, ForeignKey, Index,
    Integer, String, Text, UniqueConstraint, func, text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


def _enum(e: type[enum.Enum]) -> Enum:
    # stored as plain strings: portable and easy to read in the database
    return Enum(e, native_enum=False, length=30)


# ---------- enums (names == values, lowercase) ----------
class UnitType(str, enum.Enum):
    studio = "studio"
    apartment = "apartment"
    other = "other"


class LeaseStatus(str, enum.Enum):
    active = "active"
    ended = "ended"
    terminated = "terminated"


class DepositStatus(str, enum.Enum):
    held = "held"
    refunded = "refunded"
    partially_refunded = "partially_refunded"
    forfeited = "forfeited"


class PaymentMethod(str, enum.Enum):
    cash = "cash"
    bank = "bank"
    mobile_money = "mobile_money"   # optional alternative


class IdDocType(str, enum.Enum):
    nic = "nic"
    residence_permit = "residence_permit"
    passport = "passport"


class ExpenseCategory(str, enum.Enum):
    repairs = "repairs"
    installation = "installation"
    maintenance = "maintenance"
    water_bill = "water_bill"
    tax = "tax",
    cleaning = "cleaning",
    waste_removal = "waste_removal",
    sewage_removal = "sewage_removal",
    other = "other"


# ---------- people ----------
class User(Base):
    """The people who log in (dad + the two others). Same access for all."""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(160), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    whatsapp_number: Mapped[Optional[str]] = mapped_column(String(30), unique=True)  # bot whitelist
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Tenant(Base):
    """Fields mirror the tenancy agreement."""
    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[Optional[str]] = mapped_column(String(10))             # Dr / Mr / Mrs
    full_name: Mapped[str] = mapped_column(String(160), index=True)
    id_doc_type: Mapped[Optional[IdDocType]] = mapped_column(_enum(IdDocType))
    id_doc_number: Mapped[Optional[str]] = mapped_column(String(60))
    id_issued_at: Mapped[Optional[str]] = mapped_column(String(80))      # place
    id_issued_on: Mapped[Optional[date]] = mapped_column(Date)
    phone: Mapped[Optional[str]] = mapped_column(String(30))
    whatsapp_number: Mapped[Optional[str]] = mapped_column(String(30))   # for reminders (phase 2)
    email: Mapped[Optional[str]] = mapped_column(String(160))
    next_of_kin_name: Mapped[Optional[str]] = mapped_column(String(160))
    next_of_kin_phone: Mapped[Optional[str]] = mapped_column(String(30))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    leases: Mapped[list["Lease"]] = relationship(back_populates="tenant")


# ---------- property ----------
class House(Base):
    __tablename__ = "houses"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    address: Mapped[Optional[str]] = mapped_column(String(255))
    notes: Mapped[Optional[str]] = mapped_column(Text)

    units: Mapped[list["Unit"]] = relationship(back_populates="house")


class Unit(Base):
    __tablename__ = "units"
    __table_args__ = (UniqueConstraint("house_id", "label"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    house_id: Mapped[int] = mapped_column(ForeignKey("houses.id"))
    label: Mapped[str] = mapped_column(String(40))                       # e.g. "A2", "Studio 3"
    unit_type: Mapped[UnitType] = mapped_column(_enum(UnitType), default=UnitType.apartment)
    description: Mapped[Optional[str]] = mapped_column(Text)             # e.g. "2 bedrooms, balcony"
    listed_rent: Mapped[Optional[int]] = mapped_column(Integer)          # a default only; real rent is per lease

    house: Mapped[House] = relationship(back_populates="units")
    leases: Mapped[list["Lease"]] = relationship(back_populates="unit")


# ---------- leases ----------
class Lease(Base):
    __tablename__ = "leases"
    __table_args__ = (
        # a unit can only have ONE active lease at a time
        Index(
            "uq_one_active_lease_per_unit", "unit_id", unique=True,
            postgresql_where=text("status = 'active'"),
            sqlite_where=text("status = 'active'"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    unit_id: Mapped[int] = mapped_column(ForeignKey("units.id"), index=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    start_date: Mapped[date] = mapped_column(Date)       # month 1 of rent starts here
    end_date: Mapped[Optional[date]] = mapped_column(Date)  # contract term, max 2 years then review
    status: Mapped[LeaseStatus] = mapped_column(_enum(LeaseStatus), default=LeaseStatus.active)
    grace_days: Mapped[int] = mapped_column(Integer, default=5)   # contract: pay within 5 days of expiry

    # caution deposit: always 2 months of base rent; carries over when a lease is renewed
    deposit_amount: Mapped[int] = mapped_column(Integer, default=0)
    deposit_status: Mapped[DepositStatus] = mapped_column(_enum(DepositStatus), default=DepositStatus.held)
    deposit_refunded: Mapped[int] = mapped_column(Integer, default=0)
    deposit_notes: Mapped[Optional[str]] = mapped_column(Text)   # damage deductions etc.

    previous_lease_id: Mapped[Optional[int]] = mapped_column(ForeignKey("leases.id"))  # renewal chain
    notice_given_on: Mapped[Optional[date]] = mapped_column(Date)  # termination notice (1 month)
    ended_on: Mapped[Optional[date]] = mapped_column(Date)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    unit: Mapped[Unit] = relationship(back_populates="leases")
    tenant: Mapped[Tenant] = relationship(back_populates="leases")
    terms: Mapped[list["LeaseTerm"]] = relationship(back_populates="lease", order_by="LeaseTerm.effective_from")
    payments: Mapped[list["Payment"]] = relationship(back_populates="lease")
    adjustments: Mapped[list["Adjustment"]] = relationship(back_populates="lease")


class LeaseTerm(Base):
    """Rent history. First row = negotiated rent at move-in. A rent increase is a
    new row whose effective_from is the day the tenant's current paid period expires
    (contract: 3 months' notice - record when notice was given)."""
    __tablename__ = "lease_terms"
    __table_args__ = (
        UniqueConstraint("lease_id", "effective_from"),
        CheckConstraint("base_rent > 0"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    lease_id: Mapped[int] = mapped_column(ForeignKey("leases.id"), index=True)
    effective_from: Mapped[date] = mapped_column(Date)
    base_rent: Mapped[int] = mapped_column(Integer)
    water_fee: Mapped[int] = mapped_column(Integer, default=0)     # added on top of base rent
    waste_fee: Mapped[int] = mapped_column(Integer, default=0)     # waste mgmt / security lighting
    notice_given_on: Mapped[Optional[date]] = mapped_column(Date)

    lease: Mapped[Lease] = relationship(back_populates="terms")


# ---------- money in ----------
class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (CheckConstraint("amount > 0"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    lease_id: Mapped[int] = mapped_column(ForeignKey("leases.id"), index=True)
    paid_on: Mapped[date] = mapped_column(Date)
    amount: Mapped[int] = mapped_column(Integer)
    method: Mapped[PaymentMethod] = mapped_column(_enum(PaymentMethod))
    reference: Mapped[Optional[str]] = mapped_column(String(80))       # bank slip / transaction ref
    received_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    note: Mapped[Optional[str]] = mapped_column(Text)

    # snapshot of the period this payment newly covered (computed by billing.payment_coverage)
    covers_from: Mapped[Optional[date]] = mapped_column(Date)
    covers_to: Mapped[Optional[date]] = mapped_column(Date)

    # cash tracking: NULL until the cash is banked
    deposited_on: Mapped[Optional[date]] = mapped_column(Date)

    # never delete - void with a reason
    is_void: Mapped[bool] = mapped_column(Boolean, default=False)
    void_reason: Mapped[Optional[str]] = mapped_column(Text)
    voided_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    voided_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    lease: Mapped[Lease] = relationship(back_populates="payments")
    receipt: Mapped[Optional["Receipt"]] = relationship(back_populates="payment", uselist=False)


class Receipt(Base):
    """Mirrors the paper receipt: N°, received from, amount (words + figures),
    purpose, avance (= payment amount), reste (= balance), place, date, signature.
    `id` IS the receipt number - sequential and never reused (receipts are not deleted)."""
    __tablename__ = "receipts"

    id: Mapped[int] = mapped_column(primary_key=True)
    payment_id: Mapped[int] = mapped_column(ForeignKey("payments.id"), unique=True)
    issued_on: Mapped[date] = mapped_column(Date)
    purpose: Mapped[str] = mapped_column(String(255))                  # "Rents and utilities for Aug-Sept 2025"
    balance_remaining: Mapped[int] = mapped_column(Integer, default=0) # "Reste"
    place: Mapped[str] = mapped_column(String(80), default="Buea")

    payment: Mapped[Payment] = relationship(back_populates="receipt")


class Adjustment(Base):
    """Discounts, waivers, corrections or opening balances.
    Positive = credit to the tenant, negative = extra charge."""
    __tablename__ = "adjustments"

    id: Mapped[int] = mapped_column(primary_key=True)
    lease_id: Mapped[int] = mapped_column(ForeignKey("leases.id"), index=True)
    amount: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(Text)
    adjusted_on: Mapped[date] = mapped_column(Date)
    created_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))

    lease: Mapped[Lease] = relationship(back_populates="adjustments")


# ---------- money out ----------
class Expense(Base):
    __tablename__ = "expenses"
    __table_args__ = (CheckConstraint("amount > 0"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    house_id: Mapped[int] = mapped_column(ForeignKey("houses.id"), index=True)
    unit_id: Mapped[Optional[int]] = mapped_column(ForeignKey("units.id"))   # NULL = whole house
    category: Mapped[ExpenseCategory] = mapped_column(_enum(ExpenseCategory))
    amount: Mapped[int] = mapped_column(Integer)
    incurred_on: Mapped[date] = mapped_column(Date)
    description: Mapped[Optional[str]] = mapped_column(Text)
    paid_to: Mapped[Optional[str]] = mapped_column(String(120))
    created_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ---------- audit ----------
class AuditLog(Base):
    """Who changed what, when, and from where. Written on every create/update/void."""
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"))
    source: Mapped[str] = mapped_column(String(20), default="web")     # web | whatsapp | system
    action: Mapped[str] = mapped_column(String(40))                    # e.g. payment.create, payment.void
    entity_type: Mapped[str] = mapped_column(String(40))
    entity_id: Mapped[Optional[int]] = mapped_column(Integer)
    changes: Mapped[Optional[dict]] = mapped_column(JSON)
