import os
from typing import List
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse as FastAPIFileResponse
from sqlalchemy.orm import Session

from .. import models, schemas
from ..dependencies import get_db, get_current_user, get_active_membership

router = APIRouter(prefix="/files", tags=["files"])

UPLOAD_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
if not os.path.exists(UPLOAD_ROOT):
    os.makedirs(UPLOAD_ROOT, exist_ok=True)


@router.get("/", response_model=List[schemas.FileResponse])
def list_files(
    membership: models.OrgMembership = Depends(get_active_membership),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if membership.role == "admin":
        results = db.query(models.File).filter(models.File.org_id == membership.org_id).all()
    else:
        owned = db.query(models.File).filter(
            models.File.org_id == membership.org_id,
            models.File.created_by == current_user.id,
        )
        shared = (
            db.query(models.File)
            .join(models.FilePermission)
            .filter(
                models.File.org_id == membership.org_id,
                models.FilePermission.user_id == current_user.id,
            )
        )
        results = owned.union(shared).all()

    files = []
    for file_item in results:
        shared_with = [perm.user_id for perm in file_item.permissions]
        files.append(
            schemas.FileResponse(
                id=file_item.id,
                org_id=file_item.org_id,
                file_name=file_item.file_name,
                storage_url=file_item.storage_url,
                created_by=file_item.created_by,
                shared_with=shared_with,
            )
        )
    return files


@router.post("/upload", response_model=schemas.FileResponse)
def upload_file(
    file: UploadFile = File(...),
    membership: models.OrgMembership = Depends(get_active_membership),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    safe_name = file.filename.replace(" ", "_")
    timestamp = str(int(__import__("time").time()))
    target_file_name = f"{current_user.id}_{timestamp}_{safe_name}"
    path = os.path.join(UPLOAD_ROOT, target_file_name)
    with open(path, "wb") as buffer:
        buffer.write(file.file.read())

    storage_url = f"/uploads/{target_file_name}"
    db_file = models.File(
        org_id=membership.org_id,
        file_name=file.filename,
        storage_url=storage_url,
        created_by=current_user.id,
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    return schemas.FileResponse(
        id=db_file.id,
        org_id=db_file.org_id,
        file_name=db_file.file_name,
        storage_url=db_file.storage_url,
        created_by=db_file.created_by,
        shared_with=[],
    )


@router.post("/share", response_model=schemas.Message)
def share_file(
    request: schemas.FileShare,
    membership: models.OrgMembership = Depends(get_active_membership),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    file_item = db.query(models.File).filter(
        models.File.id == request.file_id,
        models.File.org_id == membership.org_id,
    ).first()
    if not file_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    if file_item.created_by != current_user.id and membership.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No permission to share this file")

    org_user_ids = [
        m.user_id for m in
        db.query(models.OrgMembership).filter(models.OrgMembership.org_id == membership.org_id).all()
    ]
    valid_ids = [uid for uid in request.user_ids if uid in org_user_ids]
    if not valid_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid org members found")

    for uid in valid_ids:
        existing = (
            db.query(models.FilePermission)
            .filter(models.FilePermission.file_id == file_item.id, models.FilePermission.user_id == uid)
            .first()
        )
        if not existing:
            permission = models.FilePermission(
                file_id=file_item.id,
                user_id=uid,
                role=request.role or "viewer",
            )
            db.add(permission)
    db.commit()
    return {"detail": "File shared successfully"}


@router.get("/download/{file_id}")
def download_file(
    file_id: int,
    membership: models.OrgMembership = Depends(get_active_membership),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    file_item = db.query(models.File).filter(
        models.File.id == file_id,
        models.File.org_id == membership.org_id,
    ).first()
    if not file_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    allowed = (
        file_item.created_by == current_user.id
        or membership.role == "admin"
        or db.query(models.FilePermission).filter(
            models.FilePermission.file_id == file_id,
            models.FilePermission.user_id == current_user.id,
        ).first()
    )
    if not allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No permission")
    path = os.path.abspath(os.path.join(UPLOAD_ROOT, os.path.basename(file_item.storage_url)))
    if not os.path.exists(path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File missing on disk")
    return FastAPIFileResponse(path, filename=file_item.file_name)
