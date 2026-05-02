from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..dependencies import get_db, get_current_user, get_active_membership
from ..auth import get_password_hash

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=List[schemas.OrgMemberResponse])
def list_org_users(
    membership: models.OrgMembership = Depends(get_active_membership),
    db: Session = Depends(get_db),
):
    """List all members in the active organization."""
    members = (
        db.query(models.OrgMembership)
        .filter(models.OrgMembership.org_id == membership.org_id)
        .all()
    )
    result = []
    for m in members:
        user = db.query(models.User).filter(models.User.id == m.user_id).first()
        if user:
            result.append(schemas.OrgMemberResponse(
                id=m.id,
                user_id=user.id,
                email=user.email,
                name=user.name,
                role=m.role,
            ))
    return result


@router.post("/", response_model=schemas.OrgMemberResponse)
def create_user_in_org(
    payload: schemas.CreateUserInOrgRequest,
    membership: models.OrgMembership = Depends(get_active_membership),
    db: Session = Depends(get_db),
):
    """Admin creates a brand-new user and adds them directly to the active org."""
    if membership.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can add users")

    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered. Use 'Add Existing' instead.")

    user = models.User(
        email=payload.email,
        name=payload.email.split("@")[0],
        password_hash=get_password_hash(payload.password),
    )
    db.add(user)
    db.flush()

    new_membership = models.OrgMembership(
        user_id=user.id,
        org_id=membership.org_id,
        role=payload.role or "user",
    )
    db.add(new_membership)
    db.commit()
    db.refresh(user)

    return schemas.OrgMemberResponse(
        id=new_membership.id,
        user_id=user.id,
        email=user.email,
        name=user.name,
        role=new_membership.role,
    )


@router.post("/add-to-org", response_model=schemas.OrgMemberResponse)
def add_existing_user_to_org(
    payload: schemas.AddUserToOrgRequest,
    membership: models.OrgMembership = Depends(get_active_membership),
    db: Session = Depends(get_db),
):
    """Admin adds an already-registered user to the active organization."""
    if membership.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can add users")

    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found. They must register first.")

    # Check if already a member of THIS org
    existing = (
        db.query(models.OrgMembership)
        .filter(models.OrgMembership.user_id == user.id, models.OrgMembership.org_id == membership.org_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is already a member of this organization")

    new_membership = models.OrgMembership(
        user_id=user.id,
        org_id=membership.org_id,
        role=payload.role or "user",
    )
    db.add(new_membership)
    db.commit()
    db.refresh(new_membership)

    return schemas.OrgMemberResponse(
        id=new_membership.id,
        user_id=user.id,
        email=user.email,
        name=user.name,
        role=new_membership.role,
    )


@router.delete("/{membership_id}", response_model=schemas.Message)
def remove_user_from_org(
    membership_id: int,
    current_membership: models.OrgMembership = Depends(get_active_membership),
    db: Session = Depends(get_db),
):
    """Admin removes a user from the active organization (doesn't delete their account)."""
    if current_membership.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can remove users")

    target = (
        db.query(models.OrgMembership)
        .filter(models.OrgMembership.id == membership_id, models.OrgMembership.org_id == current_membership.org_id)
        .first()
    )
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membership not found")
    if target.user_id == current_membership.user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot remove yourself")

    db.delete(target)
    db.commit()
    return {"detail": "User removed from organization"}
