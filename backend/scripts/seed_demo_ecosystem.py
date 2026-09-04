"""CLI Script to populate or refresh the Legal Metrology Demo Master Database."""
from __future__ import annotations

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.database import SessionLocal, engine, Base
from app.services.demo_seeder import seed_demo_database

def main():
    print("[1/2] Initializing database tables...")
    Base.metadata.create_all(bind=engine)
    
    print("[2/2] Running Master Ecosystem Seeder...")
    db = SessionLocal()
    try:
        results = seed_demo_database(db, force=True)
        print("Done!", results)
    finally:
        db.close()

if __name__ == "__main__":
    main()
