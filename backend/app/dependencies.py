from fastapi import Depends, HTTPException, Header, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session
from typing import Optional

from . import auth, models, database

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = auth.decode_access_token(token)
        user_id: int = payload.get("user_id")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user


def get_active_project_id(x_project_id: Optional[str] = Header(None)) -> Optional[int]:
    """Extract the active project ID from the X-Project-Id header.
    Returns None if not provided (implies Private scope)."""
    if x_project_id is None:
        return None
    try:
        return int(x_project_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid X-Project-Id header")


def get_active_membership(
    current_user: models.User = Depends(get_current_user),
    active_project_id: Optional[int] = Depends(get_active_project_id),
    db: Session = Depends(get_db),
) -> Optional[models.ProjectMembership]:
    """Get the user's membership for the active project. 
    If active_project_id is None, returns None (Private scope).
    Raises 403 if ID provided but not a member."""
    if active_project_id is None:
        return None

    membership = (
        db.query(models.ProjectMembership)
        .filter(models.ProjectMembership.user_id == current_user.id, models.ProjectMembership.project_id == active_project_id)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a member of this project")
    return membership
