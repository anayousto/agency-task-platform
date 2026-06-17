import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import ensure_agency_user_valid, get_current_user, require_roles
from app.core.security import hash_password
from app.db.session import get_db
from app.models import Agency, User, UserRole
from app.schemas import UserCreate, UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


def validate_agency(db: Session, agency_id: uuid.UUID | None) -> None:
    if agency_id and not db.get(Agency, agency_id):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Agency does not exist")


@router.get("", response_model=list[UserRead])
def list_users(
    search: str | None = Query(default=None),
    agency_id: uuid.UUID | None = None,
    role: UserRole | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
) -> list[User]:
    query = select(User).order_by(User.created_at.desc())
    if search:
        query = query.where((User.name.ilike(f"%{search}%")) | (User.email.ilike(f"%{search}%")))
    if agency_id:
        query = query.where(User.agency_id == agency_id)
    if role:
        query = query.where(User.role == role)
    return list(db.scalars(query).all())


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
) -> User:
    ensure_agency_user_valid(payload.role, payload.agency_id)
    validate_agency(db, payload.agency_id)
    if db.scalar(select(User).where(User.email == payload.email.lower())):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")

    user = User(
        name=payload.name,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role=payload.role,
        agency_id=payload.agency_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserRead)
def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.admin)),
) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    data = payload.model_dump(exclude_unset=True)
    next_role = data.get("role", user.role)
    next_agency_id = data.get("agency_id", user.agency_id)
    ensure_agency_user_valid(next_role, next_agency_id)
    validate_agency(db, next_agency_id)

    if "email" in data:
        data["email"] = data["email"].lower()
        existing = db.scalar(select(User).where(User.email == data["email"], User.id != user_id))
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")
    if "password" in data:
        user.password_hash = hash_password(data.pop("password"))
    for field, value in data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: User = Depends(require_roles(UserRole.admin)),
) -> None:
    if user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot delete your own account")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    db.delete(user)
    db.commit()
