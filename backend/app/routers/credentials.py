from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..dependencies import get_db, get_current_user, get_active_membership

router = APIRouter(prefix="/credentials", tags=["credentials"])


@router.get("/", response_model=List[schemas.CredentialResponse])
def list_credentials(
    membership: models.ProjectMembership = Depends(get_active_membership),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List credentials:
    1. If X-Project-Id is provided: Show all project credentials.
    2. If no Project-Id: Show private credentials (owned by user with project_id=null).
    """
    if membership:
        # User is viewing a project. Show all credentials in that project.
        results = db.query(models.Credential).filter(
            models.Credential.project_id == membership.project_id
        ).all()
    else:
        # User is viewing "My Vault" (Private).
        results = db.query(models.Credential).filter(
            models.Credential.project_id == None,
            models.Credential.created_by == current_user.id
        ).all()

    credentials = []
    for credential in results:
        shared_with = [perm.user_id for perm in credential.permissions]
        creator = db.query(models.User).filter(models.User.id == credential.created_by).first()
        credentials.append(
            schemas.CredentialResponse(
                id=credential.id,
                project_id=credential.project_id,
                domain=credential.domain,
                username=credential.username,
                password=credential.password,
                created_by=credential.created_by,
                creator_name=creator.name if creator else "Unknown",
                creator_email=creator.email if creator else "Unknown",
                shared_with=shared_with,
            )
        )
    return credentials


@router.post("/", response_model=schemas.CredentialResponse)
def create_credential(
    request: schemas.CredentialCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Validation: If project_id is provided, check membership
    if request.project_id:
        membership = db.query(models.ProjectMembership).filter(
            models.ProjectMembership.user_id == current_user.id,
            models.ProjectMembership.project_id == request.project_id
        ).first()
        if not membership:
            raise HTTPException(status_code=403, detail="Not a member of that project")

    credential = models.Credential(
        project_id=request.project_id,
        domain=request.domain,
        username=request.username,
        password=request.password,
        created_by=current_user.id,
    )
    db.add(credential)
    db.commit()
    db.refresh(credential)
    
    return schemas.CredentialResponse(
        id=credential.id,
        project_id=credential.project_id,
        domain=credential.domain,
        username=credential.username,
        password=credential.password,
        created_by=credential.created_by,
        creator_name=current_user.name,
        creator_email=current_user.email,
        shared_with=[],
    )


@router.post("/share", response_model=schemas.Message)
def share_credential(
    request: schemas.CredentialShare,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    credential = db.query(models.Credential).filter(models.Credential.id == request.credential_id).first()
    if not credential:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    if credential.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can share")

    for uid in request.user_ids:
        existing = (
            db.query(models.CredentialPermission)
            .filter(models.CredentialPermission.credential_id == credential.id, models.CredentialPermission.user_id == uid)
            .first()
        )
        if not existing:
            permission = models.CredentialPermission(
                credential_id=credential.id,
                user_id=uid,
                role=request.role or "viewer",
            )
            db.add(permission)
    db.commit()
    return {"detail": "Credential shared successfully"}
