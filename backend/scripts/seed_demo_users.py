"""Create local demonstration accounts only when explicitly enabled.

This script is intentionally separate from the API and is never imported by
FastAPI. It will not run unless ENABLE_DEMO_SEED is set to ``true``.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# Running a script by path makes ``scripts`` the import root on Windows.
# Add the backend directory so this script works from the documented command.
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

if os.getenv("ENABLE_DEMO_SEED", "").lower() != "true":
    sys.exit("Refusing to seed users. Set ENABLE_DEMO_SEED=true for a local demo run.")

required = ("DEMO_LMO_EMAIL", "DEMO_GATC_EMAIL", "DEMO_ADMIN_EMAIL", "DEMO_USER_PASSWORD")
missing = [name for name in required if not os.getenv(name)]
if missing:
    sys.exit(f"Missing required demo environment variable(s): {', '.join(missing)}")

from app.database import SessionLocal
from app.models.user import User
from app.utils.security import hash_password


def main() -> None:
    password_hash = hash_password(os.environ["DEMO_USER_PASSWORD"])
    accounts = (
        ("LMO", os.environ["DEMO_LMO_EMAIL"], "Demo Legal Metrology Officer", "Tamil Nadu", "Chennai"),
        ("GATC", os.environ["DEMO_GATC_EMAIL"], "Demo GATC Officer", "Maharashtra", "Mumbai"),
        ("ADMIN", os.environ["DEMO_ADMIN_EMAIL"], "Demo Platform Administrator", "Delhi", "New Delhi"),
    )
    db = SessionLocal()
    try:
        for role, email, full_name, state, district in accounts:
            existing = db.query(User).filter(User.email == email).first()
            if existing:
                existing.state = state
                existing.district = district
                existing.hashed_password = password_hash
                existing.is_active = True
                print(f"Updated user and password: {email} ({existing.role} in {district}, {state})")
                continue
            db.add(
                User(
                    full_name=full_name,
                    email=email,
                    hashed_password=password_hash,
                    role=role,
                    is_active=True,
                    state=state,
                    district=district,
                    organization_name="Legal Metrology Regional Division",
                    contact_number="+91 98765 43210"
                )
            )
            print(f"Created: {email} ({role} in {district}, {state})")
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
