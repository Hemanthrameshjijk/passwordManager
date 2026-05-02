from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas, auth
from ..dependencies import get_db, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=schemas.Token)
def login(request: schemas.LoginRequest, db: Session = Depends(get_db)):
    """Login for any user."""
    user = db.query(models.User).filter(models.User.email == request.email).first()
    if not user or not auth.verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = auth.create_access_token({"user_id": user.id})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=schemas.UserWithProjectsResponse)
def get_me(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get profile with all project memberships."""
    memberships = db.query(models.ProjectMembership).filter(models.ProjectMembership.user_id == current_user.id).all()

    projects = []
    for m in memberships:
        proj = db.query(models.Project).filter(models.Project.id == m.project_id).first()
        projects.append(schemas.ProjectMembershipResponse(
            id=m.id,
            project_id=m.project_id,
            project_name=proj.name if proj else "Unknown",
            role=m.role,
        ))

    return schemas.UserWithProjectsResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        is_active=current_user.is_active,
        is_superadmin=current_user.is_superadmin,
        projects=projects,
    )
