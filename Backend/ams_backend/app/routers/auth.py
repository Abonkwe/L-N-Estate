"""Authentication and user management endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from .. import schemas as s
from ..db import get_db
from ..deps import current_user
from ..security import create_token, hash_password, verify_password
from ..services import audit, commit

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=s.Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)) -> s.Token:
    """
    Authenticate a user via email and password (FR-A1).
    OAuth2PasswordRequestForm maps the `username` field to the user's email.
    """
    user = db.scalar(select(m.User).where(m.User.email == form.username.strip().lower()))
    if not user or not user.is_active or not verify_password(form.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return s.Token(access_token=create_token(user.id))


@router.get("/me", response_model=s.UserOut)
def me(user: m.User = Depends(current_user)) -> m.User:
    """Return profile details for the currently logged-in user."""
    return user


@router.post("/users", response_model=s.UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    data: s.UserCreate,
    db: Session = Depends(get_db),
    user: m.User = Depends(current_user),
) -> m.User:
    """
    Register a new user (FR-A1, FR-A2).
    All 3 system users share equal permissions, allowing any active user to add another.
    """
    new_user = m.User(
        full_name=data.full_name,
        email=data.email.strip().lower(),
        password_hash=hash_password(data.password),
        whatsapp_number=data.whatsapp_number,
    )
    db.add(new_user)
    db.flush()
    audit(db, user, "user.create", "user", new_user.id, {"email": new_user.email})
    commit(db, "A user with this email or WhatsApp number already exists")
    return new_user
