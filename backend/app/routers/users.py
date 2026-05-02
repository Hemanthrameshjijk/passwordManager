from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..dependencies import get_db, get_current_user, get_active_membership
from ..auth import get_password_hash

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/search", response_model=List[schemas.UserSearchResponse])
def search_users(
    query: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Search for users by email or name (Global)."""
    users = (
        db.query(models.User)
        .filter(
            (models.User.email.contains(query)) | (models.User.name.contains(query))
        )
        .limit(10)
        .all()
    )
    return users


@router.get("/", response_model=List[schemas.ProjectMemberResponse])
def list_project_members(
    membership: models.ProjectMembership = Depends(get_active_membership),
    db: Session = Depends(get_db),
):
    """List all members in the active project."""
    if not membership:
         raise HTTPException(status_code=400, detail="X-Project-Id header required to list project members")

    members = (
        db.query(models.ProjectMembership)
        .filter(models.ProjectMembership.project_id == membership.project_id)
        .all()
    )
    result = []
    for m in members:
        user = db.query(models.User).filter(models.User.id == m.user_id).first()
        if user:
            result.append(schemas.ProjectMemberResponse(
                id=m.id,
                user_id=user.id,
                email=user.email,
                name=user.name,
                role=m.role,
            ))
    return result


@router.post("/register", response_model=schemas.UserResponse)
def register_user(
    payload: schemas.CreateUserRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Super-admin registers a brand-new user."""
    if not current_user.is_superadmin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only super-admins can register users")

    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = models.User(
        email=payload.email,
        name=payload.name or payload.email.split("@")[0],
        password_hash=get_password_hash(payload.password),
        is_superadmin=payload.is_superadmin or False
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return user


@router.post("/add-to-project", response_model=schemas.ProjectMemberResponse)
def add_user_to_project(
    payload: schemas.AddUserToProjectRequest,
    membership: models.ProjectMembership = Depends(get_active_membership),
    db: Session = Depends(get_db),
):
    """Project admin adds an existing user to the active project."""
    if not membership:
         raise HTTPException(status_code=400, detail="X-Project-Id header required")
    
    if membership.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only project admins can add users")

    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found. Admin must register them first.")

    # Check if already a member
    existing = (
        db.query(models.ProjectMembership)
        .filter(models.ProjectMembership.user_id == user.id, models.ProjectMembership.project_id == membership.project_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is already a member of this project")

    new_membership = models.ProjectMembership(
        user_id=user.id,
        project_id=membership.project_id,
        role=payload.role or "user",
    )
    db.add(new_membership)
    db.commit()
    db.refresh(new_membership)

    return schemas.ProjectMemberResponse(
        id=new_membership.id,
        user_id=user.id,
        email=user.email,
        name=user.name,
        role=new_membership.role,
    )


@router.delete("/{membership_id}", response_model=schemas.Message)
def remove_user_from_project(
    membership_id: int,
    current_membership: models.ProjectMembership = Depends(get_active_membership),
    db: Session = Depends(get_db),
):
    """Project admin removes a user from the project."""
    if not current_membership:
         raise HTTPException(status_code=400, detail="X-Project-Id header required")

    if current_membership.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only project admins can remove users")

    target = (
        db.query(models.ProjectMembership)
        .filter(models.ProjectMembership.id == membership_id, models.ProjectMembership.project_id == current_membership.project_id)
        .first()
    )
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membership not found")
    
    db.delete(target)
    db.commit()
    return {"detail": "User removed from project"}
