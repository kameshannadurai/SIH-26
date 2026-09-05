import os

from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
from contextlib import asynccontextmanager
from app.database import get_db, Base, engine, SessionLocal
from app.models import User
from app.routers.auth import router as auth_router
from app.routers import instruments, applications, admin
from app.routers.workflow import assignments, verifications, certificates, notifications, enforcement, public, ai, storage_router
from app.routers.gatc_rules import router as gatc_rules_router
from app.routers.complaints import router as complaints_router
from app.routers.scheduling import router as scheduling_router
from app.routers.auto_scheduling import router as auto_scheduling_router
from app.routers.ai_chat import router as ai_chat_router
from app.utils.security import hash_password

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-initialize database tables
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"[Startup Warning] Base.metadata.create_all: {e}")

    # Ensure master demo ecosystem exists out-of-the-box
    try:
        db = SessionLocal()
        try:
            from app.services.demo_seeder import seed_demo_database
            seed_demo_database(db, force=False)
        finally:
            db.close()
    except Exception as e:
        print(f"[Startup Warning] Demo ecosystem seed: {e}")
    yield

app = FastAPI(
    title="Legal Metrology Digital Verification Platform",
    description="Online verification and digital certification system for weighing and measuring instruments.",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/api/sync-logo")
def sync_logo():
    import base64, shutil
    from pathlib import Path
    _src = Path(r"C:\Users\Lenovo\.gemini\antigravity-ide\brain\b6371b01-fd39-422d-8fc3-179fa0b96d77\.user_uploaded\media_1787777817777.png")
    if _src.exists():
        _b64 = base64.b64encode(_src.read_bytes()).decode('utf-8')
        _js_content = f"export const logoDataUri = 'data:image/png;base64,{_b64}';\n"
        for _dest in [
            Path(r"c:\Users\Lenovo\Desktop\legal-metrology-platform\web\src"),
            Path(r"c:\Users\Lenovo\Desktop\legal-metrology-platform\web1\web\src")
        ]:
            _dest.mkdir(parents=True, exist_ok=True)
            (_dest / "logoData.js").write_text(_js_content, encoding='utf-8')
            (_dest / "logo.png").write_bytes(_src.read_bytes())
            (_dest / "logo_light.png").write_bytes(_src.read_bytes())
            (_dest / "logo_dark.png").write_bytes(_src.read_bytes())
        return {"status": "success", "copied": True}
    return {"status": "not_found", "copied": False}


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
app.include_router(gatc_rules_router)
app.include_router(complaints_router)
app.include_router(scheduling_router)
app.include_router(auto_scheduling_router)
app.include_router(ai_chat_router)
app.include_router(storage_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r".*",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_error(_: Request, __: Exception):
    return JSONResponse(status_code=500, content={"success": False, "error_code": "INTERNAL_ERROR", "message": "An unexpected error occurred"})


from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse


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
