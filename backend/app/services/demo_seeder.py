"""Complete Master Demo Database Seeder for Government-Grade Legal Metrology Ecosystem.

Populates comprehensive, realistic master datasets for India (starting with all 38 Tamil Nadu districts):
- Administrative and Jurisdictional Officers (LMOs for districts)
- Govt. Approved Test Centres (GATC Testing Laboratories)
- Commercial Businesses & Establishments
- 18-Category Instruments across accuracy classes
- Realistic Verification Applications & Routing Assignments
- Digital Verification Certificates with QR tokens and SHA-256 Hashes
- Citizen Complaints, Timelines, Repeat Offenders & Risk Scoring Matrix
- Commercial Shop Registry & Inspection Schedules

Idempotent: Safe to execute repeatedly without duplicating data.
"""
from __future__ import annotations

import hashlib
import json
import secrets
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import (
    AuditLog,
    CertificateVerification,
    CitizenComplaint,
    ComplaintEvidence,
    ComplaintTimeline,
    InspectionSlot,
    Instrument,
    Notification,
    OfficerAvailability,
    ShopRegistry,
    User,
    VerificationApplication,
    VerificationAssignment,
    VerificationCertificate,
    VerificationMeasurement,
    VerificationObservation,
    VerificationRecord,
)
from app.services.domain import (
    GATC_18_CATEGORIES,
    audit,
    calculate_establishment_risk,
    certificate_digest,
)
from app.utils.security import hash_password

TAMIL_NADU_DISTRICTS = [
    {"name": "Chennai", "lat": 13.0827, "lon": 80.2707},
    {"name": "Coimbatore", "lat": 11.0168, "lon": 76.9558},
    {"name": "Madurai", "lat": 9.9252, "lon": 78.1198},
    {"name": "Tiruchirappalli", "lat": 10.7905, "lon": 78.7047},
    {"name": "Salem", "lat": 11.6643, "lon": 78.1460},
    {"name": "Tirunelveli", "lat": 8.7139, "lon": 77.7567},
    {"name": "Vellore", "lat": 12.9165, "lon": 79.1325},
    {"name": "Erode", "lat": 11.3410, "lon": 77.7172},
    {"name": "Tiruppur", "lat": 11.1085, "lon": 77.3411},
    {"name": "Kanchipuram", "lat": 12.8342, "lon": 79.7036},
    {"name": "Thanjavur", "lat": 10.7870, "lon": 79.1378},
    {"name": "Dindigul", "lat": 10.3673, "lon": 77.9803},
    {"name": "Cuddalore", "lat": 11.7480, "lon": 79.7714},
    {"name": "Kanyakumari", "lat": 8.0883, "lon": 77.5385},
    {"name": "Thoothukudi", "lat": 8.7642, "lon": 78.1348},
    {"name": "Dharmapuri", "lat": 12.1211, "lon": 78.1582},
    {"name": "Krishnagiri", "lat": 12.5186, "lon": 78.2137},
    {"name": "Nagapattinam", "lat": 10.7672, "lon": 79.8449},
    {"name": "Karur", "lat": 10.9601, "lon": 78.0766},
    {"name": "Nilgiris", "lat": 11.4102, "lon": 76.6950},
    {"name": "Chengalpattu", "lat": 12.6841, "lon": 79.9836},
    {"name": "Ariyalur", "lat": 11.1401, "lon": 79.0786},
    {"name": "Kallakurichi", "lat": 11.7384, "lon": 78.9639},
    {"name": "Mayiladuthurai", "lat": 11.1018, "lon": 79.6522},
    {"name": "Namakkal", "lat": 11.2189, "lon": 78.1674},
    {"name": "Perambalur", "lat": 11.2342, "lon": 78.8820},
    {"name": "Pudukkottai", "lat": 10.3833, "lon": 78.8001},
    {"name": "Ramanathapuram", "lat": 9.3639, "lon": 78.8395},
    {"name": "Ranipet", "lat": 12.9272, "lon": 79.3330},
    {"name": "Sivaganga", "lat": 9.8433, "lon": 78.4809},
    {"name": "Tenkasi", "lat": 8.9594, "lon": 77.3150},
    {"name": "Theni", "lat": 10.0104, "lon": 77.4768},
    {"name": "Tirupathur", "lat": 12.4925, "lon": 78.5678},
    {"name": "Tiruvallur", "lat": 13.1432, "lon": 79.9082},
    {"name": "Tiruvannamalai", "lat": 12.2253, "lon": 79.0747},
    {"name": "Tiruvarur", "lat": 10.7725, "lon": 79.6365},
    {"name": "Viluppuram", "lat": 11.9401, "lon": 79.4861},
    {"name": "Virudhunagar", "lat": 9.5680, "lon": 77.9624},
]


def seed_demo_database(db: Session, force: bool = False) -> dict[str, int]:
    """Populates comprehensive Legal Metrology demonstration ecosystem."""
    # Check if database already has data
    inst_count = db.query(func.count(Instrument.id)).scalar() or 0
    if inst_count > 10 and not force:
        print("[Demo Seeder] Database already contains records. Skipping seed to prevent overwrite.")
        return {"status": "skipped", "instruments": inst_count}

    print("==================================================================")
    print("  SEEDING COMPLETE ENTERPRISE LEGAL METROLOGY DEMO ECOSYSTEM")
    print("==================================================================")

    default_pw_hash = hash_password("Password123")
    stats = {
        "users": 0,
        "gatc_centres": 0,
        "instruments": 0,
        "applications": 0,
        "certificates": 0,
        "complaints": 0,
        "shops": 0,
        "slots": 0,
    }

    # --------------------------------------------------------------------------
    # 1. PLATFORM ADMINISTRATOR
    # --------------------------------------------------------------------------
    admin = db.query(User).filter(User.email == "admin@test.com").first()
    if not admin:
        admin = User(
            full_name="Thiru V. Srinivasan, IAS",
            email="admin@test.com",
            hashed_password=default_pw_hash,
            role="ADMIN",
            is_active=True,
            state="Tamil Nadu",
            district="Chennai",
            organization_name="Directorate of Legal Metrology, Govt of Tamil Nadu",
            contact_number="+91 44 2841 4500",
            address="Commissionerate of Commercial Taxes & Legal Metrology, Ezhilagam, Chepauk, Chennai 600005",
            latitude=13.0645,
            longitude=80.2818,
        )
        db.add(admin)
        db.flush()
        stats["users"] += 1

    # --------------------------------------------------------------------------
    # 2. LEGAL METROLOGY OFFICERS (LMOs) ACROSS DISTRICTS
    # --------------------------------------------------------------------------
    lmo_roster = [
        ("lmo.chennai@test.com", "Thiru S. Murugan", "Chennai", 13.0827, 80.2707, "Chennai District Metrology Division, Kuralagam"),
        ("lmo.coimbatore@test.com", "Thiru K. Balasubramanian", "Coimbatore", 11.0168, 76.9558, "Coimbatore Regional Metrology Office, Dr. Nanjappa Road"),
        ("lmo.madurai@test.com", "Tmt. R. Meenakshi Sundaram", "Madurai", 9.9252, 78.1198, "Madurai South Legal Metrology Division, Collectorate Campus"),
        ("lmo.trichy@test.com", "Thiru V. Soundararajan", "Tiruchirappalli", 10.7905, 78.7047, "Tiruchirappalli Metrology Division, Cantonment"),
        ("lmo.salem@test.com", "Thiru P. Ramanathan", "Salem", 11.6643, 78.1460, "Salem District Metrology Division, Bretts Road"),
        ("lmo.tirunelveli@test.com", "Thiru M. Chelliah", "Tirunelveli", 8.7139, 77.7567, "Tirunelveli Regional Inspection Wing, Palayamkottai"),
        ("lmo.vellore@test.com", "Tmt. S. Gomathi", "Vellore", 12.9165, 79.1325, "Vellore Metrology Inspection Division, Fort Round Road"),
        ("lmo.erode@test.com", "Thiru T. Vijayaraghavan", "Erode", 11.3410, 77.7172, "Erode Commercial Crops & Metrology Wing, Brough Road"),
        ("lmo.kanchipuram@test.com", "Thiru A. Chandrasekhar", "Kanchipuram", 12.8342, 79.7036, "Kanchipuram District Enforcement Office, Gandhi Road"),
        ("lmo.thanjavur@test.com", "Tmt. N. Vijayalakshmi", "Thanjavur", 10.7870, 79.1378, "Thanjavur Delta Zone Verification Office, Court Road"),
    ]

    lmo_users = {}
    for email, name, district, lat, lon, org in lmo_roster:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                full_name=name,
                email=email,
                hashed_password=default_pw_hash,
                role="LMO",
                is_active=True,
                state="Tamil Nadu",
                district=district,
                organization_name=org,
                contact_number="+91 94440 " + str(secrets.randbelow(90000) + 10000),
                address=f"{org}, {district}, Tamil Nadu",
                latitude=lat,
                longitude=lon,
            )
            db.add(user)
            db.flush()
            stats["users"] += 1
        lmo_users[district] = user

    # --------------------------------------------------------------------------
    # 3. GOVERNMENT APPROVED TEST CENTRES (GATCs) ACROSS TAMIL NADU & REGIONS
    # --------------------------------------------------------------------------
    gatc_roster = [
        (
            "gatc.chennai@test.com",
            "National Metrology Testing Laboratory (GATC Chennai)",
            "Chennai",
            13.0102,
            80.2158,
            "GATC Accredited Centre No. TN-GATC-001",
            ["water_meter", "flow_meter", "gas_meter", "energy_meter", "automatic_rail_weighbridge", "multi_dim_measuring"],
        ),
        (
            "gatc.coimbatore@test.com",
            "Coimbatore Industrial Calibration & Test Centre (GATC West)",
            "Coimbatore",
            11.0285,
            77.0034,
            "GATC Accredited Centre No. TN-GATC-002",
            ["load_cell", "non_auto_weighing_class_3", "non_auto_weighing_class_4", "beam_scale", "counter_machine", "speed_meter"],
        ),
        (
            "gatc.madurai@test.com",
            "South Tamil Nadu Legal Metrology Laboratory (GATC South)",
            "Madurai",
            9.9392,
            78.1472,
            "GATC Accredited Centre No. TN-GATC-003",
            ["clinical_thermometer", "sphygmomanometer", "breath_analyser", "moisture_meter", "tape_measure", "weights_all"],
        ),
        (
            "gatc.trichy@test.com",
            "Central TN Heavy Weights & Measures Testing Facility (GATC Central)",
            "Tiruchirappalli",
            10.7812,
            78.7180,
            "GATC Accredited Centre No. TN-GATC-004",
            ["automatic_rail_weighbridge", "load_cell", "flow_meter", "water_meter"],
        ),
        (
            "gatc.mumbai@test.com",
            "Western Region Metrology Test Centre (GATC Mumbai)",
            "Mumbai",
            19.0760,
            72.8777,
            "GATC Apex Laboratory No. MH-GATC-001",
            GATC_18_CATEGORIES,
        ),
    ]

    gatc_users = {}
    for email, name, district, lat, lon, org, cats in gatc_roster:
        user = db.query(User).filter(User.email == email).first()
        state = "Maharashtra" if district == "Mumbai" else "Tamil Nadu"
        if not user:
            user = User(
                full_name=name,
                email=email,
                hashed_password=default_pw_hash,
                role="GATC",
                is_active=True,
                state=state,
                district=district,
                organization_name=org,
                contact_number="+91 44 2250 " + str(secrets.randbelow(9000) + 1000),
                address=f"{name}, Industrial Estate, {district}, {state}",
                latitude=lat,
                longitude=lon,
                role_specific_info={"accredited_categories": cats, "gatc_license_no": f"GATC-2025-{district.upper()[:3]}-09"},
            )
            db.add(user)
            db.flush()
            stats["users"] += 1
            stats["gatc_centres"] += 1
        gatc_users[district] = user

    # --------------------------------------------------------------------------
    # 4. REGISTERED COMMERCIAL BUSINESSES ACROSS DISTRICTS
    # --------------------------------------------------------------------------
    business_roster = [
        ("business@test.com", "Thiru R. Senthil Nathan", "Bharat Scales & Trading Corp", "Chennai", "No. 42, Anna Salai, Chennai 600002", 13.0612, 80.2625),
        ("business.chennai@test.com", "Thiru N. Kumaravel", "Sri Kumaran Gold & Diamonds Ltd", "Chennai", "12, Usman Road, T. Nagar, Chennai 600017", 13.0418, 80.2341),
        ("business.coimbatore@test.com", "Thiru P. Arumugam", "Kovai Agro Commodities & Oil Mandi", "Coimbatore", "88, Mettupalayam Road, Coimbatore 641043", 11.0312, 76.9480),
        ("business.madurai@test.com", "Tmt. S. Lakshmi", "Meenakshi Supermarket & Provisioners", "Madurai", "45, West Masi Street, Madurai 625001", 9.9198, 78.1142),
        ("business.trichy@test.com", "Thiru M. Rajendran", "Cauvery Delta Grain Mandi & Logistics", "Tiruchirappalli", "102, Gandhi Market Road, Trichy 620008", 10.7950, 78.6920),
        ("business.salem@test.com", "Thiru K. Velusamy", "Salem Steel Logistics Weighbridge Terminal", "Salem", "Plot 14, Steel Plant Road, Salem 636030", 11.6820, 78.1150),
        ("business.tiruppur@test.com", "Thiru C. Natarajan", "Tiruppur Global Garments Quality Hub", "Tiruppur", "55, Avinashi Road, Tiruppur 641602", 11.1150, 77.3520),
        ("business.erode@test.com", "Thiru G. Loganathan", "Erode Spices & Turmeric Auction Mandi", "Erode", "22, Semmampalayam Road, Erode 638009", 11.3320, 77.7290),
        ("business.thoothukudi@test.com", "Thiru J. Antony", "Pearl City Marine Fuel & Cargo Terminal", "Thoothukudi", "Port New Express Highway, Thoothukudi 628004", 8.7520, 78.1420),
        ("business.vellore@test.com", "Dr. A. Sundaram", "Vellore Medicare Hospital Supplies Ltd", "Vellore", "7, Arcot Road, Thottapalayam, Vellore 632004", 12.9240, 79.1410),
        ("business.kanyakumari@test.com", "Thiru T. Sahayam", "Cape Fisheries Cold Storage Cooperative", "Kanyakumari", "Beach Road, Vadasery, Nagercoil 629001", 8.1812, 77.4280),
    ]

    biz_users = {}
    for email, signatory, org, district, addr, lat, lon in business_roster:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                full_name=signatory,
                email=email,
                hashed_password=default_pw_hash,
                role="BUSINESS",
                is_active=True,
                state="Tamil Nadu",
                district=district,
                organization_name=org,
                contact_number="+91 98400 " + str(secrets.randbelow(90000) + 10000),
                address=addr,
                latitude=lat,
                longitude=lon,
            )
            db.add(user)
            db.flush()
            stats["users"] += 1
        biz_users[district] = user

    # --------------------------------------------------------------------------
    # 5. SHOP REGISTRY ESTABLISHMENTS WITH RISK SCORES
    # --------------------------------------------------------------------------
    sample_shops = [
        ("Sri Kumaran Gold & Diamonds Ltd", "N. Kumaravel", "TN-CHE-JEW-2021", "Chennai", "12, Usman Road, T. Nagar", 13.0418, 80.2341, 12, 0, 0),
        ("Balaji Sweets & Savouries Store", "M. Balaji", "TN-CHE-RET-1092", "Chennai", "77, Pondy Bazaar, T. Nagar", 13.0401, 80.2355, 82, 3, 1),
        ("Kovai Agro Commodities Mandi", "P. Arumugam", "TN-CBE-AGR-4412", "Coimbatore", "88, Mettupalayam Road", 11.0312, 76.9480, 18, 1, 0),
        ("Sri Meenakshi Supermarket", "S. Lakshmi", "TN-MDU-SUP-3301", "Madurai", "45, West Masi Street", 9.9198, 78.1142, 22, 1, 0),
        ("Cauvery Delta Grain Merchants", "M. Rajendran", "TN-TRI-GRA-9912", "Tiruchirappalli", "102, Gandhi Market Road", 10.7950, 78.6920, 15, 0, 0),
        ("Salem Highway Heavy Weighbridge", "K. Velusamy", "TN-SLM-WB-8812", "Salem", "Plot 14, Steel Plant Road", 11.6820, 78.1150, 76, 2, 1),
        ("Tiruppur Export Quality Lab", "C. Natarajan", "TN-TPR-TEX-5501", "Tiruppur", "55, Avinashi Road", 11.1150, 77.3520, 10, 0, 0),
        ("Erode Spices & Turmeric Auction", "G. Loganathan", "TN-ERD-SP-7714", "Erode", "22, Semmampalayam Road", 11.3320, 77.7290, 68, 2, 1),
        ("Pearl City Marine Fuel Terminal", "J. Antony", "TN-TUT-FUL-3390", "Thoothukudi", "Port New Express Highway", 8.7520, 78.1420, 24, 0, 0),
        ("Vellore Medicare Diagnostic Supplies", "Dr. A. Sundaram", "TN-VEL-MED-8801", "Vellore", "7, Arcot Road, Thottapalayam", 12.9240, 79.1410, 14, 0, 0),
        ("Annapoorna Provision Stores", "S. Venkatesh", "TN-CHE-PRV-4512", "Chennai", "18, Royapettah High Road", 13.0512, 80.2612, 58, 2, 0),
        ("Simmakkal Fresh Meat & Poultry", "K. Subbiah", "TN-MDU-MT-7712", "Madurai", "31, Simmakkal Street", 9.9310, 78.1210, 64, 2, 1),
    ]

    for shop_name, owner, reg_no, district, addr, lat, lon, risk, complaints, violations in sample_shops:
        existing = db.query(ShopRegistry).filter(ShopRegistry.shop_name == shop_name).first()
        if not existing:
            shop = ShopRegistry(
                shop_name=shop_name,
                registration_number=reg_no,
                owner_name=owner,
                contact_number="+91 94433 " + str(secrets.randbelow(90000) + 10000),
                address=f"{addr}, {district}, Tamil Nadu",
                state="Tamil Nadu",
                district=district,
                latitude=lat,
                longitude=lon,
                risk_score=risk,
                complaint_count=complaints,
                violation_count=violations,
                last_inspection_date=date.today() - timedelta(days=secrets.randbelow(180) + 10),
                is_flagged=(risk >= 50),
            )
            db.add(shop)
            stats["shops"] += 1
    db.flush()

    # --------------------------------------------------------------------------
    # 6. COMPREHENSIVE 18-CATEGORY DEMO INSTRUMENTS
    # --------------------------------------------------------------------------
    instruments_catalog = [
        # (category, manufacturer, model, capacity, class, unit, district_key, is_gatc)
        ("non_auto_weighing_class_3", "Essae", "DS-215 Commercial Retail Scale", "30 kg", "Class III", "kg", "Chennai", True),
        ("non_auto_weighing_class_4", "Avery Weigh-Tronix", "ZM510 Heavy Industrial Scale", "500 kg", "Class IIII", "kg", "Coimbatore", True),
        ("automatic_rail_weighbridge", "Schenck Process", "RailScan Heavy In-Motion Weighbridge", "120 t", "Class 0.5", "t", "Tiruchirappalli", True),
        ("sphygmomanometer", "Omron Healthcare", "HBP-1320 Professional Digital Monitor", "0-300 mmHg", "Medical Grade Class II", "mmHg", "Vellore", True),
        ("clinical_thermometer", "Hicks India", "Oval Precision Digital Clinical Gauge", "32-42 °C", "Class 1", "°C", "Vellore", True),
        ("water_meter", "Kranti Meters", "Class B Domestic Multi-Jet DN15", "15 mm (3 m³/h)", "Class B", "m³", "Chennai", True),
        ("flow_meter", "Krohne", "Optimass 6400 Coriolis Mass Flow Meter", "0-500 L/min", "Class 0.2", "L/min", "Thoothukudi", True),
        ("energy_meter", "Secure Meters", "Premier 300 3-Phase Industrial Meter", "10-60 A", "Class 0.5S", "kWh", "Chennai", True),
        ("moisture_meter", "Kett Electric", "PM-650 Advanced Grain Moisture Meter", "6-40 %", "Class 0.5", "%", "Erode", True),
        ("speed_meter", "Truvelo", "Doppler Radar Vehicle Speed Detector", "0-250 km/h", "Class 1", "km/h", "Salem", True),
        ("breath_analyser", "Dräger Safety", "Alcotest 6820 Fuel Cell Sensor", "0.0-5.0 mg/L", "Medical Forensic Class", "mg/L", "Madurai", True),
        ("load_cell", "Zemic", "H8C Nickel Plated Shear Beam Cell", "5000 kg", "Class C3", "kg", "Salem", True),
        ("tape_measure", "Freemans", "Pro-Grip 50m Dip Steel Tape", "50 m", "Class II", "m", "Tiruppur", True),
        ("weights_all", "National Metrology", "Cast Iron Hexagonal Weight Set M1", "1 g - 20 kg", "Class M1", "kg", "Madurai", True),
        ("counter_machine", "Salter", "Mechanical Dial Counter Scale", "10 kg", "Class III", "kg", "Coimbatore", True),
        ("beam_scale", "Standard Precision", "Equal Arm Brass Precision Scale", "5 kg", "Class C", "kg", "Chennai", True),
        ("multi_dim_measuring", "Mettler Toledo", "CSN840 Volume & Dimension Scanner", "120x120x120 cm", "Class I", "cm", "Thoothukudi", True),
        ("gas_meter", "Pietro Fiorentini", "Diaphragm Commercial Gas Meter G4", "6 m³/h", "Class 1.5", "m³", "Chennai", True),
        # Non-GATC items
        ("commercial_gold_balance", "Mettler Toledo", "ME204 Precision Carat Balance", "220 g", "Class II", "g", "Chennai", False),
        ("fuel_dispenser_nozzle", "Tokheim", "Quantium Multi-Product Dispenser", "45 L/min", "Class 0.5", "L", "Coimbatore", False),
        ("platform_scale_1t", "Eagle Scales", "MS-1000 Platform Scale", "1000 kg", "Class III", "kg", "Madurai", False),
        ("tanker_weighbridge_60t", "Essae", "Pitless Electronic Lorry Weighbridge", "60 t", "Class III", "t", "Salem", False),
    ]

    instruments_created = []
    for idx, (cat, mfr, model, cap, aclass, unit, dist_key, is_gatc) in enumerate(instruments_catalog):
        inst_id = f"LM-INST-TN-2026-{idx + 1:04d}"
        existing = db.query(Instrument).filter(Instrument.instrument_id == inst_id).first()
        if not existing:
            owner_user = biz_users.get(dist_key, biz_users["Chennai"])
            inst = Instrument(
                instrument_id=inst_id,
                owner_id=owner_user.id,
                instrument_type=cat.replace("_", " ").title(),
                category=cat,
                manufacturer=mfr,
                model=model,
                serial_number=f"SN-2026-{mfr[:3].upper()}-{idx + 1001}",
                capacity=cap,
                accuracy_class=aclass,
                measurement_unit=unit,
                year_of_manufacture=2024,
                owner_name=owner_user.organization_name,
                owner_address=owner_user.address,
                state="Tamil Nadu",
                district=dist_key,
                location=owner_user.address,
                status="ACTIVE",
                registration_date=date.today() - timedelta(days=secrets.randbelow(300) + 30),
                next_verification_due_date=date.today() + timedelta(days=secrets.randbelow(330) + 15),
                last_verification_date=date.today() - timedelta(days=secrets.randbelow(180) + 20),
            )
            db.add(inst)
            instruments_created.append((inst, dist_key, is_gatc))
            stats["instruments"] += 1
    db.flush()

    # --------------------------------------------------------------------------
    # 7. APPLICATIONS, ROUTING ASSIGNMENTS, RECORDS & CERTIFICATES
    # --------------------------------------------------------------------------
    for idx, (inst, dist_key, is_gatc) in enumerate(instruments_created):
        app_num = f"LM-APP-TN-2026-{idx + 1:04d}"
        existing_app = db.query(VerificationApplication).filter(VerificationApplication.application_number == app_num).first()
        if existing_app:
            continue

        owner_user = biz_users.get(dist_key, biz_users["Chennai"])
        app = VerificationApplication(
            application_number=app_num,
            instrument_id=inst.id,
            applicant_id=owner_user.id,
            application_type="VERIFICATION" if idx % 2 == 0 else "RE_VERIFICATION",
            requested_date=date.today() - timedelta(days=idx * 3 + 5),
            preferred_location=owner_user.address,
            remarks=f"Statutory periodic verification inspection for {inst.manufacturer} {inst.model}",
            status="CERTIFICATE_ISSUED" if idx < 16 else "ASSIGNED",
        )
        db.add(app)
        db.flush()
        stats["applications"] += 1

        # Route assignment
        if is_gatc:
            assigned_officer = gatc_users.get(dist_key, gatc_users.get("Chennai", list(gatc_users.values())[0]))
        else:
            assigned_officer = lmo_users.get(dist_key, lmo_users.get("Chennai", list(lmo_users.values())[0]))

        assignment = VerificationAssignment(
            application_id=app.id,
            assigned_officer_id=assigned_officer.id,
            scheduled_at=datetime.utcnow() - timedelta(days=idx * 2 + 1),
            location=owner_user.address,
            priority="HIGH" if idx % 4 == 0 else "NORMAL",
            status="COMPLETED" if idx < 16 else "ASSIGNED",
            created_by_id=admin.id,
        )
        db.add(assignment)
        db.flush()

        # For completed verifications, generate Records & Certificates
        if idx < 16:
            rec = VerificationRecord(
                application_id=app.id,
                instrument_id=inst.id,
                officer_id=assigned_officer.id,
                verified_at=datetime.utcnow() - timedelta(days=idx * 2),
                latitude=inst.owner_id and owner_user.latitude or 13.0827,
                longitude=inst.owner_id and owner_user.longitude or 80.2707,
                remarks="All maximum permissible error tolerances tested and within legal parameters.",
                result="PASS",
                status="COMPLETED",
                standards_used="Working Standards Weights & Precision Gauges (Class E2/F1 Traceable to NPL)",
            )
            db.add(rec)
            db.flush()

            # Add sample measurement & observation
            obs = VerificationObservation(
                verification_id=rec.id,
                observation="Physical seal intact, no mechanical backlash, lead seal stamped with official year code.",
                is_non_compliant=False,
            )
            meas = VerificationMeasurement(
                verification_id=rec.id,
                parameter="Accuracy at Nominal Full Scale",
                observed_value=100.002,
                expected_value=100.000,
                unit=inst.measurement_unit or "kg",
                within_tolerance=True,
            )
            db.add_all([obs, meas])

            # Generate Digital Certificate with QR token
            cert_num = f"LM-CERT-TN-2026-{idx + 1:04d}"
            qr_token = f"QR-LM-TN-2026-{secrets.token_hex(8).upper()}"
            valid_from = date.today() - timedelta(days=idx * 2)
            # Create a few certificates expiring soon for due-tracking demo
            valid_until = valid_from + (timedelta(days=20) if idx in (3, 7) else timedelta(days=365))

            cert = VerificationCertificate(
                certificate_number=cert_num,
                instrument_id=inst.id,
                application_id=app.id,
                verification_id=rec.id,
                valid_from=valid_from,
                valid_until=valid_until,
                result="PASS",
                certificate_hash="",
                qr_token=qr_token,
                status="VALID",
                issuing_officer_id=assigned_officer.id,
            )
            cert.certificate_hash = certificate_digest(cert, inst, app)
            db.add(cert)
            stats["certificates"] += 1

    db.flush()

    # --------------------------------------------------------------------------
    # 8. REALISTIC CITIZEN COMPLAINTS & REPEAT OFFENDERS
    # --------------------------------------------------------------------------
    complaints_data = [
        (
            "Balaji Sweets & Savouries Store",
            "77, Pondy Bazaar, T. Nagar, Chennai",
            "Chennai",
            13.0401,
            80.2355,
            "S. Parthiban",
            "+91 98401 23456",
            "INACCURATE_WEIGHT",
            "Purchased 1 kg sweets box, gross weight was 850g only including 120g cardboard packaging.",
            "HIGH",
            "IN_INVESTIGATION",
            True,
            82,
        ),
        (
            "Balaji Sweets & Savouries Store",
            "77, Pondy Bazaar, T. Nagar, Chennai",
            "Chennai",
            13.0401,
            80.2355,
            "K. Revathi",
            "+91 98402 34567",
            "TAMPERED_SEAL",
            "Digital scale reading resets to -30g before placement, cheating customers on every transaction.",
            "HIGH",
            "IN_INVESTIGATION",
            True,
            85,
        ),
        (
            "Balaji Sweets & Savouries Store",
            "77, Pondy Bazaar, T. Nagar, Chennai",
            "Chennai",
            13.0401,
            80.2355,
            "M. Anandan",
            "+91 98403 45678",
            "UNSTAMPED_INSTRUMENT",
            "Verification certificate displayed on counter expired in 2024. Stamping seal is missing.",
            "CRITICAL",
            "ACTION_TAKEN",
            True,
            88,
        ),
        (
            "Kovai Fresh Meat Stall",
            "RS Puram Main Market, Coimbatore",
            "Coimbatore",
            11.0180,
            76.9520,
            "A. Vignesh",
            "+91 94421 98765",
            "TAMPERED_SEAL",
            "Magnet suspected under the steel pan of counter scale. Weight showed 1.15kg for 1kg standard weight.",
            "HIGH",
            "ASSIGNED",
            False,
            64,
        ),
        (
            "Salem Highway Heavy Weighbridge",
            "Steel Plant Road, Salem",
            "Salem",
            11.6820,
            78.1150,
            "T. Soundararajan",
            "+91 97890 12345",
            "EXCESS_CHARGING_BY_WEIGHT",
            "Loaded sand lorry weighed 180kg heavier than source weighbridge. Refused calibration check.",
            "CRITICAL",
            "ACTION_TAKEN",
            True,
            76,
        ),
        (
            "Erode Turmeric Trading Mandi",
            "Semmampalayam Road, Erode",
            "Erode",
            11.3320,
            77.7290,
            "R. Chinnasamy",
            "+91 94432 55678",
            "INACCURATE_MOISTURE_READING",
            "Moisture meter showed 14% artificially to reduce farmer payout when actual test was 10.5%.",
            "HIGH",
            "IN_INVESTIGATION",
            False,
            68,
        ),
        (
            "Simmakkal Meat & Poultry Mart",
            "31, Simmakkal Street, Madurai",
            "Madurai",
            9.9310,
            78.1210,
            "G. Murugesan",
            "+91 99440 66778",
            "NON_STANDARD_WEIGHTS",
            "Using unverified iron stones as counter weights without government verification seal.",
            "HIGH",
            "RESOLVED",
            False,
            55,
        ),
        (
            "Annapoorna Provision Stores",
            "18, Royapettah High Road, Chennai",
            "Chennai",
            13.0512,
            80.2612,
            "D. Kavitha",
            "+91 98840 99881",
            "EXCESS_CHARGING_BY_WEIGHT",
            "Prepackaged ghee bottle labeled 1000ml contained only 910ml on certified measuring cylinder.",
            "MEDIUM",
            "IN_INVESTIGATION",
            False,
            48,
        ),
        (
            "Gandhi Market Fish Vendor Stall 14",
            "Gandhi Market, Tiruchirappalli",
            "Tiruchirappalli",
            10.7950,
            78.6920,
            "S. Jeyakumar",
            "+91 94441 22334",
            "INACCURATE_WEIGHT",
            "Suspended spring balance glass face scratched and needle sticking at 100g offset.",
            "LOW",
            "RESOLVED",
            False,
            22,
        ),
        (
            "Vellore Central Super Store",
            "Gandhi Nagar, Vellore",
            "Vellore",
            12.9410,
            79.1450,
            "Dr. N. Raghuram",
            "+91 94430 88776",
            "UNSTAMPED_INSTRUMENT",
            "Barcode billing scale verification due since 3 months. No verification sticker visible.",
            "LOW",
            "DISMISSED",
            False,
            18,
        ),
    ]

    for idx, (shop, addr, dist, lat, lon, citizen, phone, viol, desc, sev, status_val, repeat, rscore) in enumerate(complaints_data):
        cnum = f"COMP-TN-2026-{idx + 101:06d}"
        existing_c = db.query(CitizenComplaint).filter(CitizenComplaint.complaint_number == cnum).first()
        if existing_c:
            continue

        assigned_lmo = lmo_users.get(dist, lmo_users["Chennai"])
        complaint = CitizenComplaint(
            complaint_number=cnum,
            citizen_name=citizen,
            id_reference_token=f"ID-TOKEN-{secrets.token_hex(4).upper()}",
            verified_phone=phone,
            shop_name=shop,
            shop_address=addr,
            state="Tamil Nadu",
            district=dist,
            latitude=lat,
            longitude=lon,
            instrument_category="non_auto_weighing_class_3",
            complaint_category="INCORRECT_WEIGHT" if "WEIGHT" in viol else "TAMPERED_SEAL",
            violation_type=viol,
            description=desc,
            severity=sev,
            status=status_val,
            assigned_officer_id=assigned_lmo.id,
            is_repeat_offender=repeat,
            risk_score=rscore,
            resolution_notes="Inspected by LMO division. Compounding penalty issued under Section 30 of Legal Metrology Act 2009." if status_val == "RESOLVED" else None,
            action_taken="Seizure of non-standard measuring instrument & statutory compounding notice served." if status_val in ("RESOLVED", "ACTION_TAKEN") else None,
            created_at=datetime.utcnow() - timedelta(days=secrets.randbelow(30) + 1),
        )
        db.add(complaint)
        db.flush()

        # Add complaint timeline entry
        timeline = ComplaintTimeline(
            complaint_id=complaint.id,
            action="COMPLAINT_SUBMITTED",
            actor_name=citizen,
            actor_role="CITIZEN",
            notes="Citizen submitted complaint with verified mobile OTP.",
            old_status="DRAFT",
            new_status=status_val,
            created_at=complaint.created_at,
        )
        db.add(timeline)
        stats["complaints"] += 1

    # --------------------------------------------------------------------------
    # 9. OFFICER AVAILABILITY SLOTS FOR DEMO SCHEDULING
    # --------------------------------------------------------------------------
    for dist, lmo in lmo_users.items():
        # Add weekly availability
        for dow in range(0, 5):  # Mon-Fri
            avail = db.query(OfficerAvailability).filter(
                OfficerAvailability.officer_id == lmo.id,
                OfficerAvailability.day_of_week == dow,
            ).first()
            if not avail:
                avail = OfficerAvailability(
                    officer_id=lmo.id,
                    day_of_week=dow,
                    start_time="09:00",
                    end_time="17:00",
                    break_start="13:00",
                    break_end="14:00",
                    slot_duration_minutes=60,
                    max_daily_inspections=6,
                    is_active=True,
                )
                db.add(avail)

        # Pre-generate open & booked slots for today and upcoming 3 days
        today = date.today()
        for d_offset in range(0, 4):
            slot_date = today + timedelta(days=d_offset)
            times = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"]
            for s_idx, t_str in enumerate(times):
                slot_id_str = f"SLOT-{lmo.id}-{slot_date.strftime('%Y%m%d')}-{t_str.replace(':', '')}"
                existing_slot = db.query(InspectionSlot).filter(
                    InspectionSlot.officer_id == lmo.id,
                    InspectionSlot.slot_date == slot_date,
                    InspectionSlot.start_time == t_str,
                ).first()
                if not existing_slot:
                    is_booked = (s_idx == 1 and d_offset == 0)
                    slot = InspectionSlot(
                        officer_id=lmo.id,
                        slot_date=slot_date,
                        start_time=t_str,
                        end_time=f"{int(t_str[:2]) + 1:02d}:00",
                        status="BOOKED" if is_booked else "AVAILABLE",
                        booked_by_id=biz_users.get(dist, biz_users["Chennai"]).id if is_booked else None,
                        location=biz_users.get(dist, biz_users["Chennai"]).address if is_booked else f"{lmo.district} Regional Inspection Jurisdiction",
                    )
                    db.add(slot)
                    stats["slots"] += 1

    db.commit()
    print("==================================================================")
    print("  DEMO ECOSYSTEM POPULATED SUCCESSFULLY!")
    print(f"  - Users & Officers:     {stats['users']}")
    print(f"  - GATC Centres:         {stats['gatc_centres']}")
    print(f"  - Commercial Shops:     {stats['shops']}")
    print(f"  - 18-Cat Instruments:   {stats['instruments']}")
    print(f"  - Applications Routed:  {stats['applications']}")
    print(f"  - Certificates Issued:  {stats['certificates']}")
    print(f"  - Citizen Complaints:   {stats['complaints']}")
    print(f"  - Scheduling Slots:     {stats['slots']}")
    print("==================================================================")
    return stats
