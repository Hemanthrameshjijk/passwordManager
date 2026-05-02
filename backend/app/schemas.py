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

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# --- User ---
class UserResponse(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    is_active: bool
    is_superadmin: bool

    class Config:
        from_attributes = True

class UserWithProjectsResponse(UserResponse):
    """User profile with all their project memberships."""
    projects: List["ProjectMembershipResponse"] = []


# --- Project ---
class ProjectCreate(BaseModel):
    name: str

class ProjectResponse(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

class ProjectMembershipResponse(BaseModel):
    id: int
    project_id: int
    project_name: str
    role: str

    class Config:
        from_attributes = True

class ProjectMemberResponse(BaseModel):
    """A member within a project."""
    id: int
    user_id: int
    email: str
    name: Optional[str] = None
    role: str

    class Config:
        from_attributes = True


# --- Admin actions ---
class AddUserToProjectRequest(BaseModel):
    email: EmailStr
    role: Optional[str] = "user"

class CreateUserRequest(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None
    is_superadmin: Optional[bool] = False


# --- Credential ---
class CredentialCreate(BaseModel):
    domain: str
    username: str
    password: str
    project_id: Optional[int] = None

class CredentialShare(BaseModel):
    credential_id: int
    user_ids: List[int]
    role: Optional[str] = "viewer"

class CredentialResponse(BaseModel):
    id: int
    project_id: Optional[int]
    domain: str
    username: str
    password: str
    created_by: Optional[int]
    creator_name: Optional[str] = None
    creator_email: Optional[str] = None
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
    project_id: Optional[int]
    file_name: str
    storage_url: str
    created_by: Optional[int]
    creator_name: Optional[str] = None
    creator_email: Optional[str] = None
    shared_with: List[int] = []

    class Config:
        from_attributes = True

class UserSearchResponse(BaseModel):
    id: int
    email: str
    name: Optional[str] = None

    class Config:
        from_attributes = True


# --- Generic ---
class Message(BaseModel):
    detail: str
