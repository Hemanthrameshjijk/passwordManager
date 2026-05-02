from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..dependencies import get_db, get_current_user

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("/", response_model=List[schemas.ProjectMembershipResponse])
def list_projects(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """List projects the user belongs to."""
    memberships = db.query(models.ProjectMembership).filter(models.ProjectMembership.user_id == current_user.id).all()
    result = []
    for m in memberships:
        proj = db.query(models.Project).filter(models.Project.id == m.project_id).first()
        result.append(schemas.ProjectMembershipResponse(
            id=m.id,
            project_id=m.project_id,
            project_name=proj.name if proj else 'Unknown',
            role=m.role,
        ))
    return result


@router.post("/", response_model=schemas.ProjectMembershipResponse)
def create_project(request: schemas.ProjectCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Any authenticated user can create a project and become its admin."""
    existing_proj = db.query(models.Project).filter(models.Project.name == request.name).first()
    if existing_proj:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Project name already taken")

    project = models.Project(name=request.name)
    db.add(project)
    db.flush()

    membership = models.ProjectMembership(
        user_id=current_user.id,
        project_id=project.id,
        role="admin",
    )
    db.add(membership)
    db.commit()
    db.refresh(membership)

    return schemas.ProjectMembershipResponse(
        id=membership.id,
        project_id=membership.project_id,
        project_name=project.name,
        role=membership.role,
    )
