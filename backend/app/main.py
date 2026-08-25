from fastapi import FastAPI, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db

app = FastAPI(
    title="Legal Metrology Digital Verification Platform",
    description="Online verification and digital certification system for weighing and measuring instruments.",
    version="1.0.0",
)


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