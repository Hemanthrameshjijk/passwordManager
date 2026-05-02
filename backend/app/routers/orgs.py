from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..dependencies import get_db, get_current_user

router = APIRouter(prefix="/orgs", tags=["orgs"])


@router.get("/", response_model=List[schemas.OrgMembershipResponse])
def list_org_memberships(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)) -> List[schemas.OrgMembershipResponse]:
    """List the organizations the current user belongs to."""
    memberships = db.query(models.OrgMembership).filter(models.OrgMembership.user_id == current_user.id).all()
    result = []
    for membership in memberships:
        org = db.query(models.Organization).filter(models.Organization.id == membership.org_id).first()
        result.append(schemas.OrgMembershipResponse(
            id=membership.id,
            org_id=membership.org_id,
            org_name=org.name if org else 'Unknown',
            role=membership.role,
        ))
    return result


@router.post("/", response_model=schemas.OrgMembershipResponse)
def create_organization(request: schemas.OrganizationCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Create a new organization and make the current admin its owner."""
    admin_membership = db.query(models.OrgMembership).filter(
        models.OrgMembership.user_id == current_user.id,
        models.OrgMembership.role == "admin"
    ).first()
    if not admin_membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can create organizations")

    existing_org = db.query(models.Organization).filter(models.Organization.name == request.name).first()
    if existing_org:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Organization name already taken")

    organization = models.Organization(name=request.name)
    db.add(organization)
    db.flush()

    membership = models.OrgMembership(
        user_id=current_user.id,
        org_id=organization.id,
        role="admin",
    )
    db.add(membership)
    db.commit()
    db.refresh(membership)

    return schemas.OrgMembershipResponse(
        id=membership.id,
        org_id=membership.org_id,
        org_name=organization.name,
        role=membership.role,
    )
