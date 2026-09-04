"""
Reset & ensure demo users (Admin, LMO, GATC) have active status and password 'Password123'.
Run from root or backend directory:
    python backend/scripts/reset_admin_password.py
"""
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.database import SessionLocal, Base, engine
from app.models.user import User
from app.utils.security import hash_password

def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    password_hash = hash_password("Password123")

    accounts = [
        ("ADMIN", "admin@test.com", "Demo Platform Administrator", "Delhi", "New Delhi"),
        ("LMO", "lmo.chennai@test.com", "Demo Legal Metrology Officer", "Tamil Nadu", "Chennai"),
        ("GATC", "gatc.mumbai@test.com", "Demo GATC Officer", "Maharashtra", "Mumbai"),
    ]

    print("Syncing demo accounts with password 'Password123'...")
    for role, email, full_name, state, district in accounts:
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.hashed_password = password_hash
            user.is_active = True
            user.role = role
            print(f"✓ Updated password for existing {role}: {email}")
        else:
            db.add(User(
                full_name=full_name,
                email=email,
                hashed_password=password_hash,
                role=role,
                is_active=True,
                state=state,
                district=district,
                organization_name="Legal Metrology Platform",
                contact_number="+91 98765 43210"
            ))
            print(f"✓ Created new {role}: {email}")

    db.commit()
    db.close()
    print("\nAll demo accounts are ready and active!")
    print("Email: admin@test.com | Password: Password123")

if __name__ == "__main__":
    main()
