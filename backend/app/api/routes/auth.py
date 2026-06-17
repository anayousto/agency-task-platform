import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    token_hash,
    verify_password,
)
from app.db.session import get_db
from app.models import RefreshToken, User, utc_now
from app.schemas import LoginRequest, LogoutRequest, Me, RefreshRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["authentication"])


def issue_tokens(db: Session, user: User) -> TokenResponse:
    access_token = create_access_token(str(user.id), user.role.value)
    refresh_token = create_refresh_token(str(user.id))
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=token_hash(refresh_token),
            expires_at=utc_now() + timedelta(days=settings.refresh_token_expire_days),
        )
    )
    db.commit()
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return issue_tokens(db, user)


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        decoded = decode_token(payload.refresh_token, expected_type="refresh")
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    stored_token = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash(payload.refresh_token)))
    if not stored_token or stored_token.revoked_at or stored_token.expires_at < utc_now():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired or revoked")

    user = db.get(User, uuid.UUID(str(decoded["sub"])))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User no longer exists")

    stored_token.revoked_at = utc_now()
    return issue_tokens(db, user)


@router.post("/logout")
def logout(payload: LogoutRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    if payload.refresh_token:
        stored_token = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash(payload.refresh_token)))
        if stored_token and stored_token.user_id == current_user.id:
            stored_token.revoked_at = utc_now()
            db.commit()
    return {"ok": True}


@router.get("/me", response_model=Me)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
