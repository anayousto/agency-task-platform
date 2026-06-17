import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models import Agency, User, UserRole
from app.schemas import AgencyCreate, AgencyRead, AgencyUpdate

router = APIRouter(prefix="/agencies", tags=["agencies"])


@router.get("", response_model=list[AgencyRead])
def list_agencies(
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
) -> list[Agency]:
    query = select(Agency).order_by(Agency.name.asc())
    if search:
        query = query.where(Agency.name.ilike(f"%{search}%"))
    return list(db.scalars(query).all())


@router.post("", response_model=AgencyRead, status_code=status.HTTP_201_CREATED)
def create_agency(
    payload: AgencyCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
) -> Agency:
    agency = Agency(**payload.model_dump())
    db.add(agency)
    db.commit()
    db.refresh(agency)
    return agency


@router.patch("/{agency_id}", response_model=AgencyRead)
def update_agency(
    agency_id: uuid.UUID,
    payload: AgencyUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
) -> Agency:
    agency = db.get(Agency, agency_id)
    if not agency:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agency not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(agency, field, value)
    db.commit()
    db.refresh(agency)
    return agency


@router.delete("/{agency_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agency(
    agency_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
) -> None:
    agency = db.get(Agency, agency_id)
    if not agency:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agency not found")
    db.delete(agency)
    db.commit()
