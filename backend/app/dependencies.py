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


def get_active_org_id(x_org_id: Optional[str] = Header(None)) -> Optional[int]:
    """Extract the active organization ID from the X-Org-Id header.
    The frontend sends this to indicate which org the user is currently working in."""
    if x_org_id is None:
        return None
    try:
        return int(x_org_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid X-Org-Id header")


def get_active_membership(
    current_user: models.User = Depends(get_current_user),
    active_org_id: Optional[int] = Depends(get_active_org_id),
    db: Session = Depends(get_db),
) -> models.OrgMembership:
    """Get the user's membership for the active org. Raises 403 if not a member."""
    if active_org_id is None:
        raise HTTPException(status_code=400, detail="X-Org-Id header is required for this operation")

    membership = (
        db.query(models.OrgMembership)
        .filter(models.OrgMembership.user_id == current_user.id, models.OrgMembership.org_id == active_org_id)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not a member of this organization")
    return membership
