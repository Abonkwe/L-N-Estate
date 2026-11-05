import sys
from contextlib import asynccontextmanager
from pathlib import Path

# Ensure project root (containing `app`) is in sys.path when running main.py directly
_project_root = Path(__file__).resolve().parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models
from app.config import settings
from app.db import engine
from app.routers import api_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    # MVP convenience. Switch to Alembic migrations before the schema starts changing in production.
    models.Base.metadata.create_all(engine)
    yield


app = FastAPI(
    title="AMS - Apartment Management System",
    description="REST API for managing houses, units, tenants, leases, payments, and expenses.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all modular domain routers
app.include_router(api_router)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    print("\n--- Starting AMS Server on http://127.0.0.1:8000 (API Docs at http://127.0.0.1:8000/docs) ---\n")
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        app_dir=str(_project_root),
    )
