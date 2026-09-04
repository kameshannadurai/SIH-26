import pytest
from datetime import date, datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.database import Base, get_db
from app.main import app
from app.models.user import User
from app.models.platform import (
    CitizenComplaint,
    InspectionSlot,
    Instrument,
    OfficerAvailability,
    OTPVerification,
    ShopRegistry,
    VerificationApplication,
    VerificationAssignment,
)
from app.services.domain import (
    calculate_establishment_risk,
    is_gatc_category,
    route_verification_application,
    validate_gps_geofence,
)
from app.utils.security import create_access_token, hash_password

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

    # Create test accounts
    business = User(
        full_name="Metro Supermarket Chennai",
        email="business@test.com",
        hashed_password=hash_password("Password123"),
        role="BUSINESS",
        is_active=True,
        state="Tamil Nadu",
        district="Chennai",
        latitude=13.0827,
        longitude=80.2707,
    )
    lmo = User(
        full_name="Chennai LMO Inspector",
        email="lmo.chennai@test.com",
        hashed_password=hash_password("Password123"),
        role="LMO",
        is_active=True,
        state="Tamil Nadu",
        district="Chennai",
        latitude=13.0830,
        longitude=80.2710,
    )
    gatc = User(
        full_name="Chennai GATC Calibration Centre",
        email="gatc.chennai@test.com",
        hashed_password=hash_password("Password123"),
        role="GATC",
        is_active=True,
        state="Tamil Nadu",
        district="Chennai",
        latitude=13.0850,
        longitude=80.2720,
    )
    admin = User(
        full_name="System Administrator",
        email="admin@test.com",
        hashed_password=hash_password("Password123"),
        role="ADMIN",
        is_active=True,
        state="Delhi",
        district="New Delhi",
    )
    db.add_all([business, lmo, gatc, admin])
    db.commit()

    yield db
    Base.metadata.drop_all(bind=engine)


def get_token(email: str) -> str:
    db = TestingSessionLocal()
    user = db.query(User).filter_by(email=email).first()
    return create_access_token(data={"sub": str(user.id), "role": user.role, "email": user.email})


def test_18_category_smart_routing():
    db = TestingSessionLocal()
    biz = db.query(User).filter_by(email="business@test.com").first()

    # 1. GATC Category Instrument (e.g. water_meter)
    gatc_inst = Instrument(
        instrument_id="INST-GATC-001",
        owner_id=biz.id,
        instrument_type="Domestic Water Meter",
        category="water_meter",
        manufacturer="Acme Meter Co",
        model="WM-200",
        serial_number="WM-SN-9991",
        owner_name=biz.full_name,
        state="Tamil Nadu",
        district="Chennai",
    )
    db.add(gatc_inst)
    db.flush()

    app_gatc = VerificationApplication(
        application_number="LM-APP-TN-2026-0001",
        instrument_id=gatc_inst.id,
        applicant_id=biz.id,
        application_type="VERIFICATION",
        status="SUBMITTED",
    )
    db.add(app_gatc)
    db.flush()

    decision_gatc = route_verification_application(db, app_gatc, gatc_inst)
    assert decision_gatc["verification_route"] == "GATC"
    assert decision_gatc["assigned_entity"]["role"] == "GATC"
    assert "18 GATC categories" in decision_gatc["reason"]

    # 2. Non-GATC Category Instrument (e.g. general custom scale)
    non_gatc_inst = Instrument(
        instrument_id="INST-LMO-002",
        owner_id=biz.id,
        instrument_type="Custom Platform Measure",
        category="custom_general_measure",
        manufacturer="Heavy Weigh Corp",
        model="HW-500",
        serial_number="HW-SN-8882",
        owner_name=biz.full_name,
        state="Tamil Nadu",
        district="Chennai",
    )
    db.add(non_gatc_inst)
    db.flush()

    app_lmo = VerificationApplication(
        application_number="LM-APP-TN-2026-0002",
        instrument_id=non_gatc_inst.id,
        applicant_id=biz.id,
        application_type="VERIFICATION",
        status="SUBMITTED",
    )
    db.add(app_lmo)
    db.flush()

    decision_lmo = route_verification_application(db, app_lmo, non_gatc_inst)
    assert decision_lmo["verification_route"] == "LMO"
    assert decision_lmo["assigned_entity"]["role"] == "LMO"
    assert "Regional Legal Metrology Officer" in decision_lmo["reason"]


def test_smart_scheduling_and_collision_prevention():
    db = TestingSessionLocal()
    lmo = db.query(User).filter_by(email="lmo.chennai@test.com").first()
    biz = db.query(User).filter_by(email="business@test.com").first()

    lmo_token = get_token("lmo.chennai@test.com")
    biz_token = get_token("business@test.com")

    # 1. LMO sets working schedule for Mondays (day 0) 09:00 to 17:00, 60-min slots
    res_avail = client.post(
        "/scheduling/availability",
        headers={"Authorization": f"Bearer {lmo_token}"},
        json={
            "day_of_week": 0,
            "start_time": "09:00",
            "end_time": "17:00",
            "slot_duration_minutes": 60,
            "max_daily_inspections": 8,
            "break_start": "13:00",
            "break_end": "14:00",
        },
    )
    assert res_avail.status_code == 201

    # 2. Business creates an application
    inst = Instrument(
        instrument_id="INST-SCHED-001",
        owner_id=biz.id,
        instrument_type="Bench Scale",
        category="counter_machine",
        manufacturer="Scales Inc",
        model="BC-10",
        serial_number="BC-10-999",
        owner_name=biz.full_name,
        state="Tamil Nadu",
        district="Chennai",
    )
    db.add(inst)
    db.flush()

    app_obj = VerificationApplication(
        application_number="LM-APP-TN-2026-0033",
        instrument_id=inst.id,
        applicant_id=biz.id,
        application_type="VERIFICATION",
        status="ASSIGNED",
    )
    db.add(app_obj)
    db.commit()

    target_date = "2026-09-07"  # Monday

    # 3. Query available slots
    res_slots = client.get(
        f"/scheduling/slots/available?officer_id={lmo.id}&target_date={target_date}",
        headers={"Authorization": f"Bearer {biz_token}"},
    )
    assert res_slots.status_code == 200
    slots_data = res_slots.json()
    assert len(slots_data) > 0
    assert any(s["start_time"] == "09:00" and s["is_available"] for s in slots_data)

    # 4. Business books slot 09:00-10:00
    res_book = client.post(
        "/scheduling/book",
        headers={"Authorization": f"Bearer {biz_token}"},
        json={
            "application_number": "LM-APP-TN-2026-0033",
            "officer_id": lmo.id,
            "slot_date": target_date,
            "start_time": "09:00",
            "end_time": "10:00",
            "location": "Shop 4, Anna Salai, Chennai",
        },
    )
    assert res_book.status_code == 200
    assert res_book.json()["success"] is True

    # 5. Collision Prevention: Second attempt to book the exact same slot must return HTTP 409 Conflict
    res_collision = client.post(
        "/scheduling/book",
        headers={"Authorization": f"Bearer {biz_token}"},
        json={
            "application_number": "LM-APP-TN-2026-0033",
            "officer_id": lmo.id,
            "slot_date": target_date,
            "start_time": "09:00",
            "end_time": "10:00",
        },
    )
    assert res_collision.status_code == 409


def test_public_citizen_complaint_and_otp_flow():
    # 1. Request Citizen OTP
    res_otp = client.post(
        "/complaints/otp/send",
        json={"phone_number": "9876543210", "citizen_name": "Ravi Kumar"},
    )
    assert res_otp.status_code == 200
    otp_data = res_otp.json()
    token = otp_data["verification_token"]
    otp_code = otp_data["demo_otp_code"]

    # 2. Verify OTP
    res_verify = client.post(
        "/complaints/otp/verify",
        json={"verification_token": token, "otp_code": otp_code},
    )
    assert res_verify.status_code == 200
    assert res_verify.json()["is_verified"] is True

    # 3. Submit Public Citizen Complaint
    res_comp = client.post(
        "/complaints",
        json={
            "citizen_name": "Ravi Kumar",
            "id_reference": "XXXX-XXXX-9812",
            "verified_phone": "9876543210",
            "verification_token": token,
            "shop_name": "Kannan Sweet Stall",
            "shop_address": "12 Bazar Road, T Nagar",
            "state": "Tamil Nadu",
            "district": "Chennai",
            "latitude": 13.0418,
            "longitude": 80.2341,
            "violation_type": "Short Weight in Sweet Boxes",
            "description": "Purchased 1kg sweets box, actual weight was only 820g including heavy cardboard box.",
            "severity": "HIGH",
            "entry_method": "PORTAL",
        },
    )
    assert res_comp.status_code == 201
    comp_data = res_comp.json()
    assert comp_data["complaint_number"].startswith("COMP-TN")
    assert comp_data["status"] == "ASSIGNED"

    complaint_num = comp_data["complaint_number"]

    # 4. Public Track Complaint
    res_track = client.get(f"/complaints/track/{complaint_num}?phone=9876543210")
    assert res_track.status_code == 200
    assert res_track.json()["shop_name"] == "Kannan Sweet Stall"

    # 5. File repeat complaint against same shop -> must flag repeat offender
    res_repeat = client.post(
        "/complaints",
        json={
            "citizen_name": "Priya S",
            "verified_phone": "9876543210",
            "verification_token": token,
            "shop_name": "Kannan Sweet Stall",
            "shop_address": "12 Bazar Road, T Nagar",
            "state": "Tamil Nadu",
            "district": "Chennai",
            "violation_type": "Tampered Weight Stamping",
            "description": "Counter weight seal broken and weights are modified.",
            "severity": "CRITICAL",
        },
    )
    assert res_repeat.status_code == 201
    assert res_repeat.json()["is_repeat_offender"] is True
    assert res_repeat.json()["risk_score"] >= 45


def test_local_role_based_ai_assistant():
    biz_token = get_token("business@test.com")
    lmo_token = get_token("lmo.chennai@test.com")
    admin_token = get_token("admin@test.com")

    # 1. Business query
    res_biz_ai = client.post(
        "/ai/chat",
        headers={"Authorization": f"Bearer {biz_token}"},
        json={"query": "What is the status of my verification applications?"},
    )
    assert res_biz_ai.status_code == 200
    assert res_biz_ai.json()["role"] == "BUSINESS"

    # 2. LMO query for tolerances
    res_lmo_ai = client.post(
        "/ai/chat",
        headers={"Authorization": f"Bearer {lmo_token}"},
        json={"query": "What are the MPE error limits for Class 3 non-automatic weighing machines?"},
    )
    assert res_lmo_ai.status_code == 200
    assert "Class III" in res_lmo_ai.json()["response"]

    # 3. Admin query for risk & overview
    res_admin_ai = client.post(
        "/ai/chat",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"query": "Show summary of high risk establishments and complaints."},
    )
    assert res_admin_ai.status_code == 200
    assert res_admin_ai.json()["role"] == "ADMIN"


def test_gps_geofence_validation():
    # Inside 500m threshold
    val_close = validate_gps_geofence(
        reg_lat=13.0827,
        reg_lng=80.2707,
        act_lat=13.0830,
        act_lng=80.2710,
        threshold_meters=500.0,
    )
    assert val_close["is_valid"] is True
    assert val_close["exceeds_threshold"] is False

    # Far away (> 5km)
    val_far = validate_gps_geofence(
        reg_lat=13.0827,
        reg_lng=80.2707,
        act_lat=13.1500,
        act_lng=80.3500,
        threshold_meters=500.0,
    )
    assert val_far["is_valid"] is False
    assert val_far["exceeds_threshold"] is True
    assert "away from registered location" in val_far["warning"]
