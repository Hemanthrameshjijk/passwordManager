import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from .database import engine, SessionLocal
from . import models, auth
from .routers import auth as auth_router, users as users_router, credentials as credentials_router, files as files_router, projects as projects_router


from sqlalchemy.exc import IntegrityError

def seed_admin():
    db: Session = SessionLocal()
    try:
        admin_email = "admin@gmail.com"
        admin_pass = "admin"
        admin = db.query(models.User).filter(models.User.email == admin_email).first()
        if not admin:
            print(f"Seeding super-admin: {admin_email}")
            new_admin = models.User(
                email=admin_email,
                name="Super Admin",
                password_hash=auth.get_password_hash(admin_pass),
                is_superadmin=True
            )
            db.add(new_admin)
            try:
                db.commit()
            except IntegrityError:
                db.rollback()
                print("Super-admin already seeded by another worker.")
    except Exception as e:
        print(f"Warning: seed_admin failed: {e}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    try:
        models.Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"Warning: create_all failed (likely concurrent worker): {e}")
    
    seed_admin()
    yield
    # Shutdown logic (none needed)


app = FastAPI(title="Password Manager API", lifespan=lifespan)

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
UPLOAD_DIR = os.path.abspath(UPLOAD_DIR)
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.include_router(auth_router.router)
app.include_router(users_router.router)
app.include_router(credentials_router.router)
app.include_router(files_router.router)
app.include_router(projects_router.router)

@app.get("/")
def root():
    return {"message": "Password Manager API running"}
