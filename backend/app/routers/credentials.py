from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..dependencies import get_db, get_current_user, get_active_membership

router = APIRouter(prefix="/credentials", tags=["credentials"])


@router.get("/", response_model=List[schemas.CredentialResponse])
def list_credentials(
    membership: models.OrgMembership = Depends(get_active_membership),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List credentials in the active org: owned by me + shared with me."""
    owned = db.query(models.Credential).filter(
        models.Credential.org_id == membership.org_id,
        models.Credential.created_by == current_user.id,
    )
    shared = (
        db.query(models.Credential)
        .join(models.CredentialPermission)
        .filter(
            models.Credential.org_id == membership.org_id,
            models.CredentialPermission.user_id == current_user.id,
        )
    )

    # Admins see all credentials in the org
    if membership.role == "admin":
        results = db.query(models.Credential).filter(
            models.Credential.org_id == membership.org_id
        ).all()
    else:
        results = owned.union(shared).all()

    credentials = []
    for credential in results:
        shared_with = [perm.user_id for perm in credential.permissions]
        credentials.append(
            schemas.CredentialResponse(
                id=credential.id,
                org_id=credential.org_id,
                domain=credential.domain,
                username=credential.username,
                password=credential.password,
                created_by=credential.created_by,
                shared_with=shared_with,
            )
        )
    return credentials


@router.post("/", response_model=schemas.CredentialResponse)
def create_credential(
    request: schemas.CredentialCreate,
    membership: models.OrgMembership = Depends(get_active_membership),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    credential = models.Credential(
        org_id=membership.org_id,
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
        org_id=credential.org_id,
        domain=credential.domain,
        username=credential.username,
        password=credential.password,
        created_by=credential.created_by,
        shared_with=[],
    )


@router.post("/share", response_model=schemas.Message)
def share_credential(
    request: schemas.CredentialShare,
    membership: models.OrgMembership = Depends(get_active_membership),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    credential = db.query(models.Credential).filter(
        models.Credential.id == request.credential_id,
        models.Credential.org_id == membership.org_id,
    ).first()
    if not credential:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found")
    if credential.created_by != current_user.id and membership.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No permission to share this credential")

    # Only share with users who are members of this org
    org_user_ids = [
        m.user_id for m in
        db.query(models.OrgMembership).filter(models.OrgMembership.org_id == membership.org_id).all()
    ]
    valid_ids = [uid for uid in request.user_ids if uid in org_user_ids]
    if not valid_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid org members found")

    for uid in valid_ids:
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
