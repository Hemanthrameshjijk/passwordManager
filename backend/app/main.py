import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import engine
from . import models
from .routers import auth as auth_router, users as users_router, credentials as credentials_router, files as files_router, orgs as orgs_router

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Password Manager API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
app.include_router(orgs_router.router)

@app.get("/")
def root():
    return {"message": "Password Manager API running"}
