from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas, auth
from ..dependencies import get_db, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=schemas.Token)
def register(request: schemas.RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user (no organization yet). An admin must add them to an org."""
    existing_user = db.query(models.User).filter(models.User.email == request.email).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = models.User(
        email=request.email,
        name=request.name or request.email.split("@")[0],
        password_hash=auth.get_password_hash(request.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = auth.create_access_token({"user_id": user.id})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/admin/register", response_model=schemas.Token)
def admin_register(request: schemas.AdminRegisterRequest, db: Session = Depends(get_db)):
    """Admin registration: creates a new organization and becomes its admin."""
    existing_user = db.query(models.User).filter(models.User.email == request.email).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    existing_org = db.query(models.Organization).filter(models.Organization.name == request.org_name).first()
    if existing_org:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Organization name already taken")

    organization = models.Organization(name=request.org_name)
    db.add(organization)
    db.flush()

    user = models.User(
        email=request.email,
        name=request.name or request.email.split("@")[0],
        password_hash=auth.get_password_hash(request.password),
    )
    db.add(user)
    db.flush()

    membership = models.OrgMembership(user_id=user.id, org_id=organization.id, role="admin")
    db.add(membership)
    db.commit()
    db.refresh(user)

    token = auth.create_access_token({"user_id": user.id})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/login", response_model=schemas.Token)
def login(request: schemas.LoginRequest, db: Session = Depends(get_db)):
    """Login for any user."""
    user = db.query(models.User).filter(models.User.email == request.email).first()
    if not user or not auth.verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = auth.create_access_token({"user_id": user.id})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=schemas.UserWithOrgsResponse)
def get_me(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get profile with all organization memberships."""
    memberships = db.query(models.OrgMembership).filter(models.OrgMembership.user_id == current_user.id).all()

    orgs = []
    for m in memberships:
        org = db.query(models.Organization).filter(models.Organization.id == m.org_id).first()
        orgs.append(schemas.OrgMembershipResponse(
            id=m.id,
            org_id=m.org_id,
            org_name=org.name if org else "Unknown",
            role=m.role,
        ))

    return schemas.UserWithOrgsResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        is_active=current_user.is_active,
        orgs=orgs,
    )
