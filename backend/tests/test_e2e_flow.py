import pytest
from datetime import date, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.database import Base, get_db
from app.main import app
from app.models.user import User
from app.models.platform import Instrument, VerificationApplication, VerificationCertificate
from app.services.domain import issue_certificate, revoke_certificate, assign_to_regional_lmo
from app.utils.security import hash_password, create_access_token

# Set up test in-memory SQLite engine
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Create regional LMO for Tamil Nadu / Chennai
    lmo_user = User(
        full_name="Chennai LMO Officer",
        email="lmo.chennai@test.com",
        hashed_password=hash_password("Password123"),
        role="LMO",
        is_active=True,
        state="Tamil Nadu",
        district="Chennai",
        organization_name="Legal Metrology Department Chennai",
        contact_number="+91 44 2850 0000"
    )
    admin_user = User(
        full_name="Platform Admin",
        email="admin@test.com",
        hashed_password=hash_password("Password123"),
        role="ADMIN",
        is_active=True,
        state="Delhi",
        district="New Delhi"
    )
    db.add(lmo_user)
    db.add(admin_user)
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)

def test_full_end_to_end_verification_lifecycle():
    # 1. Business User Registration with Indian State, District, and GPS
    reg_payload = {
        "full_name": "Karthik Raja",
        "email": "karthik.scales@test.com",
        "password": "SecurePassword123",
        "role": "BUSINESS",
        "organization_name": "Raja Weighing Systems Pvt Ltd",
        "contact_number": "+91 98401 12345",
        "address": "123 Anna Salai, Thousand Lights",
        "state": "Tamil Nadu",
        "district": "Chennai",
        "latitude": 13.0604,
        "longitude": 80.2496
    }
    reg_res = client.post("/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    business_user = reg_res.json()
    assert business_user["email"] == "karthik.scales@test.com"
    assert business_user["state"] == "Tamil Nadu"
    assert business_user["district"] == "Chennai"

    # 2. Login as Business User
    login_res = client.post(
        "/auth/login",
        data={"username": "karthik.scales@test.com", "password": "SecurePassword123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    assert login_res.status_code == 200
    biz_token = login_res.json()["access_token"]
    biz_headers = {"Authorization": f"Bearer {biz_token}"}

    # 3. Instrument Registration (18 GATC 2025 category: non_auto_weighing_class_3)
    inst_payload = {
        "instrument_type": "Electronic Platform Scale",
        "category": "non_auto_weighing_class_3",
        "manufacturer": "Essae Weighing",
        "model": "DS-215",
        "serial_number": "SN-ESSAE-2026-9901",
        "capacity": "150",
        "measurement_unit": "kg",
        "accuracy_class": "Class III",
        "year_of_manufacture": 2025,
        "owner_name": "Raja Weighing Systems",
        "owner_address": "123 Anna Salai, Chennai",
        "state": "Tamil Nadu",
        "district": "Chennai",
        "location": "Thousand Lights Warehouse Bay 2",
        "installation_details": "Bolted ground platform"
    }
    inst_res = client.post("/instruments", json=inst_payload, headers=biz_headers)
    assert inst_res.status_code == 201
    instrument = inst_res.json()
    instrument_id = instrument["instrument_id"]
    assert instrument_id.startswith("LM-INST")

    # 4. Create Verification Application
    app_payload = {
        "instrument_id": instrument_id,
        "application_type": "VERIFICATION",
        "requested_date": str(date.today() + timedelta(days=2)),
        "preferred_location": "On-site Chennai Warehouse",
        "remarks": "Annual initial verification for trade usage"
    }
    app_res = client.post("/applications", json=app_payload, headers=biz_headers)
    assert app_res.status_code == 201
    application = app_res.json()
    app_number = application["application_number"]

    # 5. Submit Application (Triggers automatic regional LMO assignment)
    submit_res = client.post(f"/applications/{app_number}/submit", headers=biz_headers)
    assert submit_res.status_code == 200
    submitted_app = submit_res.json()
    assert submitted_app["status"] == "ASSIGNED"

    # 6. Login as Regional LMO (Chennai officer)
    lmo_login = client.post(
        "/auth/login",
        data={"username": "lmo.chennai@test.com", "password": "Password123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    assert lmo_login.status_code == 200
    lmo_token = lmo_login.json()["access_token"]
    lmo_headers = {"Authorization": f"Bearer {lmo_token}"}

    # 7. Check LMO Assignments list (Auto-assigned application must be present)
    assignments_res = client.get("/assignments", headers=lmo_headers)
    assert assignments_res.status_code == 200
    assignments = assignments_res.json()
    assert len(assignments) >= 1
    target_assignment = next(a for a in assignments if a["application_number"] == app_number)
    assert target_assignment["status"] == "ASSIGNED"

    # 8. Start Field Verification Screen
    start_verif_payload = {
        "application_number": app_number,
        "latitude": 13.0605,
        "longitude": 80.2497,
        "remarks": "On-site physical inspection commenced",
        "standards_used": "Class M1 Standard Test Weights 150kg set (Cal. Cert #M1-2026-08)",
        "defects_found": "None. Level bubble centered, seal intact."
    }
    verif_res = client.post("/verifications", json=start_verif_payload, headers=lmo_headers)
    assert verif_res.status_code == 201
    record_id = verif_res.json()["id"]

    # 9. Update Verification with Observations & Dynamic Measurements
    update_verif_payload = {
        "latitude": 13.0605,
        "longitude": 80.2497,
        "remarks": "Repeatability, eccentric loading, and linearity verified across range.",
        "standards_used": "Class M1 Standard Test Weights 150kg set",
        "defects_found": "None",
        "observations": [
            "Scale base is stable and level.",
            "Display digits bright and clear.",
            "Stamping cavity clean and ready for lead seal."
        ],
        "measurements": [
            {"parameter": "Zero Return Test", "observed_value": 0.0, "expected_value": 0.0, "unit": "kg", "within_tolerance": True},
            {"parameter": "Corner Load (Quarter Max)", "observed_value": 37.5, "expected_value": 37.5, "unit": "kg", "within_tolerance": True},
            {"parameter": "Half Capacity Load", "observed_value": 75.0, "expected_value": 75.0, "unit": "kg", "within_tolerance": True},
            {"parameter": "Full Capacity Load", "observed_value": 150.0, "expected_value": 150.0, "unit": "kg", "within_tolerance": True}
        ]
    }
    put_res = client.put(f"/verifications/{record_id}", json=update_verif_payload, headers=lmo_headers)
    assert put_res.status_code == 200

    # 10. Upload Evidence Photo with GPS coordinates & metadata
    evidence_res = client.post(
        f"/verifications/{record_id}/evidence",
        files={"file": ("scale_nameplate.jpg", b"\xFF\xD8\xFF\xE0FakeJPEGBinaryContent", "image/jpeg")},
        data={"latitude": "13.0605", "longitude": "80.2497", "captured_at": "2026-08-27T10:00:00Z"},
        headers=lmo_headers
    )
    assert evidence_res.status_code == 201
    evidence_data = evidence_res.json()
    assert "storage/verification-evidence" in evidence_data["path"]

    # 11. Approve Verification & Automatically Generate Digital Certificate & QR Token
    approve_res = client.post(f"/verifications/{record_id}/approve", headers=lmo_headers)
    assert approve_res.status_code == 200
    approval_data = approve_res.json()
    cert_number = approval_data["certificate_number"]
    qr_token = approval_data["qr_token"]
    assert cert_number.startswith("LM-CERT")
    assert len(qr_token) >= 20

    # 12. Public QR Verification without login
    public_verify_res = client.get(f"/public/verify/{qr_token}")
    assert public_verify_res.status_code == 200
    public_cert = public_verify_res.json()
    assert public_cert["valid"] is True
    assert public_cert["status"] == "VALID"
    assert public_cert["certificate_number"] == cert_number
    assert public_cert["certificate_hash_verified"] is True
    assert public_cert["manufacturer"] == "Essae Weighing"

    # 13. Certificate Revocation by Admin
    admin_login = client.post(
        "/auth/login",
        data={"username": "admin@test.com", "password": "Password123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    revoke_res = client.post(
        f"/certificates/{cert_number}/revoke",
        json={"reason": "Audit discrepancy identified in test mass traceability."},
        headers=admin_headers
    )
    assert revoke_res.status_code == 200
    revoked_info = revoke_res.json()
    assert revoked_info["status"] == "REVOKED"

    # 14. Public Verification reflects REVOKED status
    revoked_public_res = client.get(f"/public/verify/{qr_token}")
    assert revoked_public_res.status_code == 200
    revoked_public_data = revoked_public_res.json()
    assert revoked_public_data["status"] == "REVOKED"
    assert revoked_public_data["valid"] is False
    assert "Audit discrepancy" in (revoked_public_data["revocation_reason"] or "")

    # 15. Check Due-Tracking endpoint
    due_res = client.get("/instruments/due-tracking", headers=admin_headers)
    assert due_res.status_code == 200
    assert len(due_res.json()) >= 1
