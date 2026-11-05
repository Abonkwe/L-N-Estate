"""Tenant management endpoints (mirroring Tenancy Agreement details)."""
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .. import models as m
from .. import schemas as s
from ..db import get_db
from ..deps import current_user
from ..services import audit, commit, get_or_404

router = APIRouter(prefix="/tenants", tags=["tenants"], dependencies=[Depends(current_user)])


@router.post("", response_model=s.TenantOut, status_code=status.HTTP_201_CREATED)
def create_tenant(
    data: s.TenantIn,
    db: Session = Depends(get_db),
    user: m.User = Depends(current_user),
) -> s.TenantOut:
    """Create a new tenant record with personal & ID documentation details."""
    tenant = m.Tenant(**data.model_dump())
    db.add(tenant)
    db.flush()
    audit(db, user, "tenant.create", "tenant", tenant.id, {"full_name": tenant.full_name})
    commit(db)
    return tenant


@router.get("", response_model=list[s.TenantOut])
def list_tenants(
    q: str | None = Query(None, description="Search tenants by full name or phone number"),
    db: Session = Depends(get_db),
) -> list[s.TenantOut]:
    """List tenants with optional name/phone query search."""
    query = select(m.Tenant).order_by(m.Tenant.full_name)
    if q:
        like = f"%{q.strip()}%"
        query = query.where(or_(m.Tenant.full_name.ilike(like), m.Tenant.phone.ilike(like)))
    return list(db.scalars(query))


@router.get("/{tenant_id}", response_model=s.TenantOut)
def get_tenant(tenant_id: int, db: Session = Depends(get_db)) -> s.TenantOut:
    """Retrieve full profile details for a single tenant."""
    return get_or_404(db, m.Tenant, tenant_id, "Tenant")


@router.patch("/{tenant_id}", response_model=s.TenantOut)
def update_tenant(
    tenant_id: int,
    data: s.TenantPatch,
    db: Session = Depends(get_db),
    user: m.User = Depends(current_user),
) -> s.TenantOut:
    """Update tenant profile, contact information, or ID documents."""
    tenant = get_or_404(db, m.Tenant, tenant_id, "Tenant")
    changes = data.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(tenant, key, value)
    audit(db, user, "tenant.update", "tenant", tenant.id, changes)
    commit(db)
    return tenant
