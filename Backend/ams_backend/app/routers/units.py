"""Unit (apartment/studio) management endpoints."""
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from .. import schemas as s
from ..db import get_db
from ..deps import current_user
from ..services import audit, commit, get_or_404, unit_out

router = APIRouter(prefix="/units", tags=["units"], dependencies=[Depends(current_user)])


@router.post("", response_model=s.UnitOut, status_code=status.HTTP_201_CREATED)
def create_unit(
    data: s.UnitIn,
    db: Session = Depends(get_db),
    user: m.User = Depends(current_user),
) -> s.UnitOut:
    """Create a new rental unit inside a specified house."""
    get_or_404(db, m.House, data.house_id, "House")
    unit = m.Unit(**data.model_dump())
    db.add(unit)
    db.flush()
    audit(db, user, "unit.create", "unit", unit.id, data.model_dump())
    commit(db, "This house already has a unit with that label")
    return unit_out(unit)


@router.get("", response_model=list[s.UnitOut])
def list_units(
    house_id: int | None = Query(None, description="Filter units by house ID"),
    vacant: bool | None = Query(None, description="Filter by vacancy status (true = vacant only)"),
    db: Session = Depends(get_db),
) -> list[s.UnitOut]:
    """List units, optionally filtered by house or vacancy status."""
    query = select(m.Unit).order_by(m.Unit.house_id, m.Unit.label)
    if house_id:
        query = query.where(m.Unit.house_id == house_id)
    result = [unit_out(u) for u in db.scalars(query)]
    if vacant is not None:
        result = [u for u in result if u.is_occupied != vacant]
    return result


@router.get("/{unit_id}", response_model=s.UnitOut)
def get_unit(unit_id: int, db: Session = Depends(get_db)) -> s.UnitOut:
    """Retrieve details for a single unit, including current tenant if occupied."""
    return unit_out(get_or_404(db, m.Unit, unit_id, "Unit"))


@router.patch("/{unit_id}", response_model=s.UnitOut)
def update_unit(
    unit_id: int,
    data: s.UnitPatch,
    db: Session = Depends(get_db),
    user: m.User = Depends(current_user),
) -> s.UnitOut:
    """Update unit details (e.g., label, type, listed rent, or description)."""
    unit = get_or_404(db, m.Unit, unit_id, "Unit")
    changes = data.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(unit, key, value)
    audit(db, user, "unit.update", "unit", unit.id, changes)
    commit(db, "This house already has a unit with that label")
    return unit_out(unit)

