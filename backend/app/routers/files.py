import os
from typing import List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status, Form
from fastapi.responses import FileResponse as FastAPIFileResponse
from sqlalchemy.orm import Session

from .. import models, schemas
from ..dependencies import get_db, get_current_user, get_active_membership

router = APIRouter(prefix="/files", tags=["files"])

UPLOAD_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads"))
if not os.path.exists(UPLOAD_ROOT):
    os.makedirs(UPLOAD_ROOT, exist_ok=True)


@router.get("/tags", response_model=List[str])
def get_tags(
    membership: models.ProjectMembership = Depends(get_active_membership),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.File.tag).distinct()
    if membership:
        query = query.filter(models.File.project_id == membership.project_id)
    else:
        query = query.filter(
            models.File.project_id == None,
            models.File.created_by == current_user.id
        )
    
    tags = [t[0] for t in query.all() if t[0]]
    return tags


@router.get("/", response_model=List[schemas.FileResponse])
def list_files(
    q: Optional[str] = None,
    membership: models.ProjectMembership = Depends(get_active_membership),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.File)
    if membership:
        query = query.filter(models.File.project_id == membership.project_id)
    else:
        query = query.filter(
            models.File.project_id == None,
            models.File.created_by == current_user.id
        )

    if q:
        search = f"%{q}%"
        query = query.filter(
            (models.File.file_name.ilike(search)) | (models.File.tag.ilike(search))
        )

    results = query.all()

    files = []
    for file_item in results:
        shared_with = [perm.user_id for perm in file_item.permissions]
        creator = db.query(models.User).filter(models.User.id == file_item.created_by).first()
        files.append(
            schemas.FileResponse(
                id=file_item.id,
                project_id=file_item.project_id,
                file_name=file_item.file_name,
                storage_url=file_item.storage_url,
                tag=file_item.tag,
                created_at=file_item.created_at,
                created_by=file_item.created_by,
                creator_name=creator.name if creator else "Unknown",
                creator_email=creator.email if creator else "Unknown",
                shared_with=shared_with,
            )
        )
    return files


@router.post("/upload", response_model=schemas.FileResponse)
def upload_file(
    file: UploadFile = File(...),
    project_id: Optional[int] = Form(None),
    tag: Optional[str] = Form(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if project_id:
        membership = db.query(models.ProjectMembership).filter(
            models.ProjectMembership.user_id == current_user.id,
            models.ProjectMembership.project_id == project_id
        ).first()
        if not membership:
            raise HTTPException(status_code=403, detail="Not a member of that project")

    safe_name = file.filename.replace(" ", "_")
    timestamp = str(int(__import__("time").time()))
    target_file_name = f"{current_user.id}_{timestamp}_{safe_name}"
    path = os.path.join(UPLOAD_ROOT, target_file_name)
    with open(path, "wb") as buffer:
        buffer.write(file.file.read())

    storage_url = f"/uploads/{target_file_name}"
    db_file = models.File(
        project_id=project_id,
        file_name=file.filename,
        storage_url=storage_url,
        tag=tag,
        created_by=current_user.id,
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)

    return schemas.FileResponse(
        id=db_file.id,
        project_id=db_file.project_id,
        file_name=db_file.file_name,
        storage_url=db_file.storage_url,
        tag=db_file.tag,
        created_at=db_file.created_at,
        created_by=db_file.created_by,
        creator_name=current_user.name,
        creator_email=current_user.email,
        shared_with=[],
    )


@router.patch("/{file_id}/tag", response_model=schemas.FileResponse)
def update_file_tag(
    file_id: int,
    request: schemas.FileUpdateTag,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    file_item = db.query(models.File).filter(models.File.id == file_id).first()
    if not file_item:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Permission check: creator or project member with access (simplified to creator for now or admin)
    if file_item.created_by != current_user.id:
        # Check project membership and if they have permission (could be more complex, but for now owner)
        if file_item.project_id:
             membership = db.query(models.ProjectMembership).filter(
                models.ProjectMembership.user_id == current_user.id,
                models.ProjectMembership.project_id == file_item.project_id
            ).first()
             if not membership:
                 raise HTTPException(status_code=403, detail="No permission to update tag")
        else:
            raise HTTPException(status_code=403, detail="No permission to update tag")

    file_item.tag = request.tag
    db.commit()
    db.refresh(file_item)

    creator = db.query(models.User).filter(models.User.id == file_item.created_by).first()
    shared_with = [perm.user_id for perm in file_item.permissions]

    return schemas.FileResponse(
        id=file_item.id,
        project_id=file_item.project_id,
        file_name=file_item.file_name,
        storage_url=file_item.storage_url,
        tag=file_item.tag,
        created_at=file_item.created_at,
        created_by=file_item.created_by,
        creator_name=creator.name if creator else "Unknown",
        creator_email=creator.email if creator else "Unknown",
        shared_with=shared_with,
    )


@router.post("/share", response_model=schemas.Message)
def share_file(
    request: schemas.FileShare,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    file_item = db.query(models.File).filter(models.File.id == request.file_id).first()
    if not file_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    
    if file_item.created_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owner can share")

    for uid in request.user_ids:
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
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    file_item = db.query(models.File).filter(models.File.id == file_id).first()
    if not file_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    
    # Check if creator
    allowed = (file_item.created_by == current_user.id)
    
    # Check if project member
    if not allowed and file_item.project_id:
        membership = db.query(models.ProjectMembership).filter(
            models.ProjectMembership.user_id == current_user.id,
            models.ProjectMembership.project_id == file_item.project_id
        ).first()
        if membership:
            allowed = True
            
    # Check if explicitly shared
    if not allowed:
        shared = db.query(models.FilePermission).filter(
            models.FilePermission.file_id == file_id,
            models.FilePermission.user_id == current_user.id,
        ).first()
        if shared:
            allowed = True

    if not allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No permission")
        
    path = os.path.abspath(os.path.join(UPLOAD_ROOT, os.path.basename(file_item.storage_url)))
    if not os.path.exists(path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File missing on disk")
    return FastAPIFileResponse(path, filename=file_item.file_name)

