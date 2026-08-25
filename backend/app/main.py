from app.database import get_db
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.routers.auth import router as auth_router
from app.database import get_db
from app.models import User  # imports all domain metadata for migration discovery
from app.routers import instruments, applications, admin
from app.routers.workflow import assignments, verifications, certificates, notifications, enforcement, public, ai

app = FastAPI(
    title="Legal Metrology Digital Verification Platform",
    description="Online verification and digital certification system for weighing and measuring instruments.",
    version="1.0.0",
)
app.include_router(auth_router)
app.include_router(instruments.router)
app.include_router(applications.router)
app.include_router(assignments)
app.include_router(verifications)
app.include_router(certificates)
app.include_router(notifications)
app.include_router(enforcement)
app.include_router(public)
app.include_router(ai)
app.include_router(admin.router)
app.add_middleware(CORSMiddleware, allow_origins=__import__("os").getenv("CORS_ORIGINS", "http://localhost:5173").split(","), allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.exception_handler(Exception)
async def unhandled_error(_: Request, __: Exception):
    return JSONResponse(status_code=500, content={"success": False, "error_code": "INTERNAL_ERROR", "message": "An unexpected error occurred"})


@app.get("/")
def root():
    return {
        "message": "Legal Metrology API is running",
        "status": "success",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }


@app.get("/database-test")
def database_test(db: Session = Depends(get_db)):
    result = db.execute(text("SELECT 1")).scalar()

    return {
        "database": "connected",
        "test": result,
    }
