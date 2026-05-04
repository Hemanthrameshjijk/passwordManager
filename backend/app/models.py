from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, UniqueConstraint, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)

    memberships = relationship("ProjectMembership", back_populates="project", cascade="all, delete-orphan")
    credentials = relationship("Credential", back_populates="project")
    files = relationship("File", back_populates="project")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_superadmin = Column(Boolean, default=False, nullable=False)

    memberships = relationship("ProjectMembership", back_populates="user", cascade="all, delete-orphan")
    credentials = relationship("Credential", back_populates="creator")
    files = relationship("File", back_populates="creator")
    credential_permissions = relationship("CredentialPermission", back_populates="user")
    file_permissions = relationship("FilePermission", back_populates="user")


class ProjectMembership(Base):
    """Many-to-many: a user can belong to multiple projects."""
    __tablename__ = "project_memberships"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, default="user", nullable=False)  # "admin" or "user"

    user = relationship("User", back_populates="memberships")
    project = relationship("Project", back_populates="memberships")

    __table_args__ = (
        UniqueConstraint("user_id", "project_id", name="uq_user_project"),
    )


class Credential(Base):
    __tablename__ = "credentials"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    domain = Column(String, nullable=False)
    username = Column(String, nullable=False)
    password = Column(String, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))

    project = relationship("Project", back_populates="credentials")
    creator = relationship("User", back_populates="credentials")
    permissions = relationship("CredentialPermission", back_populates="credential")


class CredentialPermission(Base):
    __tablename__ = "credential_permissions"

    id = Column(Integer, primary_key=True, index=True)
    credential_id = Column(Integer, ForeignKey("credentials.id", ondelete="CASCADE"))
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    role = Column(String, default="viewer", nullable=False)

    credential = relationship("Credential", back_populates="permissions")
    user = relationship("User", back_populates="credential_permissions")


class File(Base):
    __tablename__ = "files"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    file_name = Column(String, nullable=False)
    storage_url = Column(String, nullable=False)
    tag = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))

    project = relationship("Project", back_populates="files")
    creator = relationship("User", back_populates="files")
    permissions = relationship("FilePermission", back_populates="file")


class FilePermission(Base):
    __tablename__ = "file_permissions"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id", ondelete="CASCADE"))
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    role = Column(String, default="viewer", nullable=False)

    file = relationship("File", back_populates="permissions")
    user = relationship("User", back_populates="file_permissions")
