from typing import List, Optional
from pydantic import BaseModel, EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[int] = None


# --- Auth ---
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None

class AdminRegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None
    org_name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# --- User ---
class UserResponse(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True

class UserWithOrgsResponse(UserResponse):
    """User profile with all their organization memberships."""
    orgs: List["OrgMembershipResponse"] = []


# --- Organization ---
class OrganizationCreate(BaseModel):
    name: str

class OrganizationResponse(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

class OrgMembershipResponse(BaseModel):
    id: int
    org_id: int
    org_name: str
    role: str

    class Config:
        from_attributes = True

class OrgMemberResponse(BaseModel):
    """A member within an organization."""
    id: int
    user_id: int
    email: str
    name: Optional[str] = None
    role: str

    class Config:
        from_attributes = True


# --- Admin actions ---
class AddUserToOrgRequest(BaseModel):
    email: EmailStr
    role: Optional[str] = "user"

class CreateUserInOrgRequest(BaseModel):
    email: EmailStr
    password: str
    role: Optional[str] = "user"


# --- Credential ---
class CredentialCreate(BaseModel):
    domain: str
    username: str
    password: str

class CredentialShare(BaseModel):
    credential_id: int
    user_ids: List[int]
    role: Optional[str] = "viewer"

class CredentialResponse(BaseModel):
    id: int
    org_id: int
    domain: str
    username: str
    password: str
    created_by: Optional[int]
    shared_with: List[int] = []

    class Config:
        from_attributes = True


# --- File ---
class FileShare(BaseModel):
    file_id: int
    user_ids: List[int]
    role: Optional[str] = "viewer"

class FileResponse(BaseModel):
    id: int
    org_id: int
    file_name: str
    storage_url: str
    created_by: Optional[int]
    shared_with: List[int] = []

    class Config:
        from_attributes = True


# --- Generic ---
class Message(BaseModel):
    detail: str
