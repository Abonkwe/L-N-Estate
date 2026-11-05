from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .models import (DepositStatus, ExpenseCategory, IdDocType, LeaseStatus,
                     PaymentMethod, UnitType)


# ---------- auth ----------
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    full_name: str = Field(min_length=2)
    email: str
    password: str = Field(min_length=8)
    whatsapp_number: str | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str
    email: str
    whatsapp_number: str | None
    is_active: bool


# ---------- houses & units ----------
class HouseBase(BaseModel):
    address: str | None = None
    notes: str | None = None


class HouseIn(HouseBase):
    name: str = Field(min_length=1)


class HousePatch(HouseBase):
    name: str | None = None


class HouseOut(HouseBase):
    id: int
    name: str
    unit_count: int = 0
    occupied_count: int = 0


class UnitBase(BaseModel):
    unit_type: UnitType | None = None
    description: str | None = None
    listed_rent: int | None = Field(default=None, gt=0)


class UnitIn(UnitBase):
    house_id: int
    label: str = Field(min_length=1)
    unit_type: UnitType = UnitType.apartment


class UnitPatch(UnitBase):
    label: str | None = None


class UnitOut(BaseModel):
    id: int
    house_id: int
    house_name: str
    label: str
    unit_type: UnitType
    description: str | None
    listed_rent: int | None
    is_occupied: bool
    lease_id: int | None
    tenant_name: str | None


# ---------- tenants ----------
class TenantBase(BaseModel):
    title: str | None = None
    id_doc_type: IdDocType | None = None
    id_doc_number: str | None = None
    id_issued_at: str | None = None
    id_issued_on: date | None = None
    phone: str | None = None
    whatsapp_number: str | None = None
    email: str | None = None
    next_of_kin_name: str | None = None
    next_of_kin_phone: str | None = None
    notes: str | None = None


class TenantIn(TenantBase):
    full_name: str = Field(min_length=2)


class TenantPatch(TenantBase):
    full_name: str | None = None


class TenantOut(TenantBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str


# ---------- leases ----------
class LeaseIn(BaseModel):
    unit_id: int
    tenant_id: int
    start_date: date
    end_date: date | None = None
    base_rent: int = Field(gt=0)
    water_fee: int = Field(default=0, ge=0)
    waste_fee: int = Field(default=0, ge=0)
    grace_days: int = Field(default=5, ge=0)
    notes: str | None = None


class TermIn(BaseModel):
    effective_from: date
    base_rent: int = Field(gt=0)
    water_fee: int = Field(default=0, ge=0)
    waste_fee: int = Field(default=0, ge=0)
    notice_given_on: date | None = None


class TermOut(TermIn):
    id: int
    monthly_total: int


class LeaseEnd(BaseModel):
    status: Literal["ended", "terminated"] = "ended"
    ended_on: date
    notes: str | None = None
    deposit_refunded: int = Field(default=0, ge=0)
    deposit_status: DepositStatus | None = None


class LeaseOut(BaseModel):
    id: int
    status: LeaseStatus
    unit_id: int
    unit_label: str
    house_id: int
    house_name: str
    tenant_id: int
    tenant_name: str
    tenant_phone: str | None
    start_date: date
    end_date: date | None
    grace_days: int
    # current charges
    base_rent: int
    water_fee: int
    waste_fee: int
    monthly_total: int
    # derived position (never stored)
    months_paid: int
    paid_through: date
    next_period_start: date
    next_month_charge: int
    credit_toward_next: int
    shortfall_next: int
    days_until_expiry: int
    days_overdue: int
    payment_status: Literal["up_to_date", "expiring_soon", "grace", "overdue", "ended"]
    # deposit
    deposit_amount: int
    deposit_status: DepositStatus
    deposit_refunded: int
    notes: str | None


class LeaseDetail(LeaseOut):
    terms: list[TermOut]


class RentSheetRow(BaseModel):
    """One row of the Word 'Rents Monitoring Sheet'."""
    sn: int
    paid_on: date
    amount: int
    period_from: date | None
    period_to: date | None
    comment: str | None
    receipt_id: int | None


# ---------- payments ----------
class PaymentIn(BaseModel):
    lease_id: int
    paid_on: date
    amount: int = Field(gt=0)
    method: PaymentMethod
    reference: str | None = None
    note: str | None = None


class VoidIn(BaseModel):
    reason: str = Field(min_length=3)


class PaymentOut(BaseModel):
    id: int
    lease_id: int
    tenant_name: str
    unit_label: str
    house_name: str
    paid_on: date
    amount: int
    method: PaymentMethod
    reference: str | None
    note: str | None
    covers_from: date | None
    covers_to: date | None
    is_void: bool
    void_reason: str | None
    receipt_id: int | None
    balance_remaining: int | None


class AdjustmentIn(BaseModel):
    lease_id: int
    amount: int
    reason: str = Field(min_length=3)
    adjusted_on: date

    @field_validator("amount")
    @classmethod
    def not_zero(cls, v: int) -> int:
        if v == 0:
            raise ValueError("amount cannot be zero")
        return v


class AdjustmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    lease_id: int
    amount: int
    reason: str
    adjusted_on: date


# ---------- expenses ----------
class ExpenseBase(BaseModel):
    unit_id: int | None = None
    description: str | None = None
    paid_to: str | None = None


class ExpenseIn(ExpenseBase):
    house_id: int
    category: ExpenseCategory
    amount: int = Field(gt=0)
    incurred_on: date


class ExpensePatch(ExpenseBase):
    house_id: int | None = None
    category: ExpenseCategory | None = None
    amount: int | None = Field(default=None, gt=0)
    incurred_on: date | None = None


class ExpenseOut(ExpenseBase):
    id: int
    house_id: int
    house_name: str
    category: ExpenseCategory
    amount: int
    incurred_on: date


# ---------- dashboard & reports ----------
class DashboardCounts(BaseModel):
    up_to_date: int = 0
    expiring_soon: int = 0
    grace: int = 0
    overdue: int = 0
    vacant_units: int = 0


class Dashboard(BaseModel):
    counts: DashboardCounts
    leases: list[LeaseOut]
    vacant_units: list[UnitOut]


class HouseMonth(BaseModel):
    house_id: int
    house_name: str
    income: int
    expenses: int
    net: int


class MonthlyReport(BaseModel):
    year: int
    month: int
    income: int
    expenses: int
    net: int
    by_house: list[HouseMonth]
    expenses_by_category: dict[str, int]


# ---------- audit ----------
class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    at: datetime
    user_id: int | None
    source: str
    action: str
    entity_type: str
    entity_id: int | None
    changes: dict | None
