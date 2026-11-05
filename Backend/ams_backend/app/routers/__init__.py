"""
AMS API Routers Aggregator.
Groups and registers all domain-specific routers into a unified APIRouter.
"""
from fastapi import APIRouter

from . import (
    adjustments,
    audit,
    auth,
    dashboard,
    expenses,
    houses,
    leases,
    payments,
    reports,
    tenants,
    units,
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(houses.router)
api_router.include_router(units.router)
api_router.include_router(tenants.router)
api_router.include_router(leases.router)
api_router.include_router(payments.router)
api_router.include_router(adjustments.router)
api_router.include_router(expenses.router)
api_router.include_router(dashboard.router)
api_router.include_router(reports.router)
api_router.include_router(audit.router)

__all__ = [
    "api_router",
    "adjustments",
    "audit",
    "auth",
    "dashboard",
    "expenses",
    "houses",
    "leases",
    "payments",
    "reports",
    "tenants",
    "units",
]

