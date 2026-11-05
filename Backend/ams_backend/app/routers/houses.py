"""House / Building management endpoints."""
from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from .. import schemas as s
from ..db import get_db
from ..deps import current_user
from ..services import audit, commit, get_or_404, house_out

router = APIRouter(prefix="/houses", tags=["houses"], dependencies=[Depends(current_user)])


@router.post("", response_model=s.HouseOut, status_code=status.HTTP_201_CREATED)
def create_house(
    data: s.HouseIn,
    db: Session = Depends(get_db),
    user: m.User = Depends(current_user),
) -> s.HouseOut:
    """Register a new house/building."""
    house = m.House(**data.model_dump())
    db.add(house)
    db.flush()
    audit(db, user, "house.create", "house", house.id, data.model_dump())
    commit(db, "A house with this name already exists")
    return house_out(house)


@router.get("", response_model=list[s.HouseOut])
def list_houses(db: Session = Depends(get_db)) -> list[s.HouseOut]:
    """List all houses with unit and occupancy metrics."""
    return [house_out(h) for h in db.scalars(select(m.House).order_by(m.House.name))]


@router.get("/{house_id}", response_model=s.HouseOut)
def get_house(house_id: int, db: Session = Depends(get_db)) -> s.HouseOut:
    """Retrieve details for a single house."""
    house = get_or_404(db, m.House, house_id, "House")
    return house_out(house)


@router.patch("/{house_id}", response_model=s.HouseOut)
def update_house(
    house_id: int,
    data: s.HousePatch,
    db: Session = Depends(get_db),
    user: m.User = Depends(current_user),
) -> s.HouseOut:
    """Update details of an existing house."""
    house = get_or_404(db, m.House, house_id, "House")
    changes = data.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(house, key, value)
    audit(db, user, "house.update", "house", house.id, changes)
    commit(db, "A house with this name already exists")
    return house_out(house)

