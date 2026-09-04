"""Shared enterprise business rules for identifiers, audit history, certificates, auto-assignment, and risk."""
from __future__ import annotations
import hashlib
import json
import secrets
from datetime import date, datetime, timedelta
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from app.models import (
    AuditLog,
    Instrument,
    Notification,
    User,
    VerificationApplication,
    VerificationAssignment,
    VerificationCertificate,
    VerificationRecord,
)


def official_number(db: Session, model: type, column: str, prefix: str, state: str | None = None) -> str:
    """Create a unique official identifier with state code and timestamp count."""
    year = datetime.utcnow().year
    count = db.query(func.count(model.id)).scalar() or 0
    region = f"-{state.upper().replace(' ', '')[:2]}" if state else ""
    return f"{prefix}{region}-{year}-{count + 1:06d}"


def audit(
    db: Session,
    actor_id: int | None,
    action: str,
    entity: str,
    entity_id: str,
    *,
    old_value: dict | None = None,
    new_value: dict | None = None,
    metadata_json: dict | None = None
) -> None:
    db.add(
        AuditLog(
            actor_id=actor_id,
            action=action,
            entity=entity,
            entity_id=entity_id,
            old_value=old_value,
            new_value=new_value,
            metadata_json=metadata_json,
        )
    )


def certificate_payload(certificate: VerificationCertificate, instrument: Instrument, application: VerificationApplication) -> dict:
    return {
        "certificate_number": certificate.certificate_number,
        "instrument_id": instrument.instrument_id,
        "application_number": application.application_number,
        "serial_number": instrument.serial_number,
        "valid_from": certificate.valid_from.isoformat(),
        "valid_until": certificate.valid_until.isoformat(),
        "result": certificate.result,
        "qr_token": certificate.qr_token,
    }


def certificate_digest(certificate: VerificationCertificate, instrument: Instrument, application: VerificationApplication) -> str:
    canonical = json.dumps(certificate_payload(certificate, instrument, application), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


def issue_certificate(
    db: Session,
    verification: VerificationRecord,
    instrument: Instrument,
    application: VerificationApplication,
    issuing_officer_id: int | None = None
) -> VerificationCertificate:
    # 1. Supersede any existing valid certificates for this instrument (version history preservation)
    db.query(VerificationCertificate).filter(
        VerificationCertificate.instrument_id == instrument.id,
        VerificationCertificate.status == "VALID"
    ).update({"status": "SUPERSEDED"})

    # 2. Issue new official certificate with unique high-entropy URL-safe QR token
    number = official_number(db, VerificationCertificate, "certificate_number", "LM-CERT", instrument.state)
    qr_token = secrets.token_urlsafe(32)
    
    certificate = VerificationCertificate(
        certificate_number=number,
        instrument_id=instrument.id,
        application_id=application.id,
        verification_id=verification.id,
        valid_from=date.today(),
        valid_until=date.today() + timedelta(days=365),
        result="PASS",
        certificate_hash="pending",
        qr_token=qr_token,
        status="VALID",
        issuing_officer_id=issuing_officer_id or verification.officer_id,
    )
    certificate.certificate_hash = certificate_digest(certificate, instrument, application)
    db.add(certificate)
    db.flush()
    return certificate


def revoke_certificate(
    db: Session,
    certificate: VerificationCertificate,
    reason: str,
    actor: User
) -> VerificationCertificate:
    certificate.status = "REVOKED"
    certificate.revocation_reason = reason
    certificate.revoked_at = datetime.utcnow()
    certificate.revoked_by_id = actor.id

    instrument = db.get(Instrument, certificate.instrument_id)
    if instrument:
        instrument.status = "REVOKED"
        # Notify owner
        db.add(
            Notification(
                user_id=instrument.owner_id,
                title="Certificate Revoked",
                message=f"Certificate {certificate.certificate_number} for instrument {instrument.instrument_id} has been revoked. Reason: {reason}",
                severity="CRITICAL"
            )
        )

    audit(
        db,
        actor.id,
        "CERTIFICATE_REVOKED",
        "certificate",
        certificate.certificate_number,
        new_value={"reason": reason, "revoked_by": actor.email}
    )
    db.commit()
    return certificate


import math
from app.models import (
    AuditLog,
    CitizenComplaint,
    EnforcementRecord,
    Instrument,
    Notification,
    ShopRegistry,
    User,
    VerificationApplication,
    VerificationAssignment,
    VerificationCertificate,
    VerificationRecord,
)

# 18 Official Sanctioned 2025 GATC Categories
GATC_18_CATEGORIES = {
    "water_meter",
    "sphygmomanometer",
    "clinical_thermometer",
    "automatic_rail_weighbridge",
    "tape_measure",
    "non_auto_weighing_class_3",
    "non_auto_weighing_class_4",
    "load_cell",
    "beam_scale",
    "counter_machine",
    "weights_all",
    "gas_meter",
    "energy_meter",
    "moisture_meter",
    "speed_meter",
    "breath_analyser",
    "multi_dim_measuring",
    "flow_meter",
}


def is_gatc_category(category_or_type: str | None) -> bool:
    """Check if the instrument category or type is in the approved 18 GATC categories."""
    if not category_or_type:
        return False
    normalized = category_or_type.strip().lower().replace(" ", "_").replace("-", "_")
    if normalized in GATC_18_CATEGORIES:
        return True
    for cat in GATC_18_CATEGORIES:
        if cat in normalized or normalized in cat:
            return True
    return False


def validate_gps_geofence(
    reg_lat: float | None,
    reg_lng: float | None,
    act_lat: float | None,
    act_lng: float | None,
    threshold_meters: float = 500.0,
) -> dict:
    """Compare registered location with actual officer verification GPS using Haversine formula."""
    if reg_lat is None or reg_lng is None or act_lat is None or act_lng is None:
        return {
            "is_valid": True,
            "distance_meters": None,
            "threshold_meters": threshold_meters,
            "warning": "GPS coordinates not available for registered location or verification site",
            "exceeds_threshold": False,
        }

    # Haversine distance
    r = 6371000.0  # Earth radius in meters
    phi1 = math.radians(reg_lat)
    phi2 = math.radians(act_lat)
    delta_phi = math.radians(act_lat - reg_lat)
    delta_lambda = math.radians(act_lng - reg_lng)

    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    distance = r * c

    exceeds = distance > threshold_meters
    return {
        "is_valid": not exceeds,
        "distance_meters": round(distance, 1),
        "threshold_meters": threshold_meters,
        "warning": f"Actual verification location is {round(distance, 1)}m away from registered location (threshold: {threshold_meters}m)" if exceeds else None,
        "exceeds_threshold": exceeds,
    }


def route_verification_application(
    db: Session,
    application: VerificationApplication,
    instrument: Instrument,
    override_officer_id: int | None = None,
    actor_id: int | None = None,
) -> dict:
    """Intelligently route an application to GATC or Regional LMO based on 18-category scope and jurisdiction."""
    is_gatc = is_gatc_category(instrument.category) or is_gatc_category(instrument.instrument_type)
    target_role = "GATC" if is_gatc else "LMO"
    officer = None

    if override_officer_id:
        officer = db.query(User).filter(User.id == override_officer_id, User.is_active == True).first()
        reason = f"Manual administrative override to {officer.role if officer else 'Officer'}"
    else:
        # 1. Look for active officer of target_role in matching district & state
        if instrument.district and instrument.state:
            officer = (
                db.query(User)
                .filter(
                    User.role == target_role,
                    User.is_active == True,
                    func.lower(User.district) == instrument.district.lower(),
                    func.lower(User.state) == instrument.state.lower(),
                )
                .first()
            )

        # 2. Look for active officer of target_role in matching state
        if not officer and instrument.state:
            officer = (
                db.query(User)
                .filter(
                    User.role == target_role,
                    User.is_active == True,
                    func.lower(User.state) == instrument.state.lower(),
                )
                .first()
            )

        # 3. Fall back to any active officer of target_role
        if not officer:
            officer = db.query(User).filter(User.role == target_role, User.is_active == True).first()

        # 4. Fall back to any LMO if target was GATC and no GATC is configured
        if not officer and target_role == "GATC":
            officer = db.query(User).filter(User.role == "LMO", User.is_active == True).first()

        # 5. Ultimate fallback to Admin
        if not officer:
            officer = db.query(User).filter(User.role == "ADMIN", User.is_active == True).first()

        reason = (
            f"Category '{instrument.category or instrument.instrument_type}' is in 18 GATC categories -> Routed to Government Approved Test Centre"
            if is_gatc
            else f"Category '{instrument.category or instrument.instrument_type}' outside GATC scope -> Routed to Regional Legal Metrology Officer (LMO)"
        )

    if not officer:
        return {
            "verification_route": target_role,
            "assigned_entity": None,
            "jurisdiction": {"state": instrument.state, "district": instrument.district},
            "reason": "No active officer found in jurisdiction or fallback pool",
            "confidence": 0.0,
            "status": "UNASSIGNED",
            "assignment_id": None,
            "audit_info": None,
        }

    # Create or update assignment
    existing = db.query(VerificationAssignment).filter_by(application_id=application.id).first()
    scheduled_time = datetime.utcnow() + timedelta(days=1)

    if existing:
        existing.assigned_officer_id = officer.id
        existing.status = "ASSIGNED"
        existing.centre_id = officer.id if officer.role == "GATC" else None
        assignment = existing
    else:
        assignment = VerificationAssignment(
            application_id=application.id,
            assigned_officer_id=officer.id,
            centre_id=officer.id if officer.role == "GATC" else None,
            scheduled_at=scheduled_time,
            location=instrument.location or f"{instrument.district}, {instrument.state}",
            priority="NORMAL",
            status="ASSIGNED",
            created_by_id=actor_id or officer.id,
        )
        db.add(assignment)

    application.status = "ASSIGNED"

    # Notify officer
    db.add(
        Notification(
            user_id=officer.id,
            title=f"New {target_role} Verification Assigned",
            message=f"Application {application.application_number} ({instrument.instrument_type} in {instrument.district}, {instrument.state}) has been assigned to you. Reason: {reason}",
            severity="NORMAL",
        )
    )

    # Notify business applicant
    if application.applicant_id:
        db.add(
            Notification(
                user_id=application.applicant_id,
                title="Application Routed & Assigned",
                message=f"Your application {application.application_number} for {instrument.instrument_type} has been routed to {officer.full_name} ({target_role} Centre/Officer).",
                severity="NORMAL",
            )
        )

    audit_action = "ASSIGNMENT_OVERRIDDEN" if override_officer_id else "ROUTING_COMPLETED"
    audit(
        db,
        actor_id,
        audit_action,
        "assignment",
        application.application_number,
        new_value={
            "officer_id": officer.id,
            "officer_name": officer.full_name,
            "officer_role": officer.role,
            "route": target_role,
            "reason": reason,
            "district": instrument.district,
            "state": instrument.state,
        },
    )

    return {
        "verification_route": target_role,
        "assigned_entity": {
            "id": officer.id,
            "full_name": officer.full_name,
            "role": officer.role,
            "email": officer.email,
        },
        "jurisdiction": {"state": instrument.state, "district": instrument.district},
        "reason": reason,
        "confidence": 1.0,
        "status": "ASSIGNED",
        "assignment_id": assignment.id,
        "audit_info": {
            "action": audit_action,
            "timestamp": datetime.utcnow().isoformat(),
        },
    }


def assign_to_regional_lmo(
    db: Session,
    application: VerificationApplication,
    instrument: Instrument,
) -> VerificationAssignment | None:
    """Wrapper that invokes route_verification_application for full backwards compatibility."""
    res = route_verification_application(db, application, instrument)
    if res.get("assignment_id"):
        return db.get(VerificationAssignment, res["assignment_id"])
    return None


def calculate_establishment_risk(
    db: Session,
    shop_id: int | None = None,
    shop_name: str | None = None,
    district: str | None = None,
    state: str | None = None,
    instrument_id: int | None = None,
) -> tuple[int, str, dict]:
    """Calculate 0-100 predictive risk score based on complaints, overdue verifications, and inspection failures."""
    factors = {
        "failed_inspections_score": 0,
        "complaints_score": 0,
        "repeat_complaint_penalty": 0,
        "overdue_score": 0,
        "enforcement_penalty": 0,
    }

    # 1. Verification failures
    if instrument_id:
        fail_count = (
            db.query(func.count(VerificationRecord.id))
            .filter(VerificationRecord.instrument_id == instrument_id, VerificationRecord.result == "FAIL")
            .scalar()
            or 0
        )
        factors["failed_inspections_score"] = min(30, fail_count * 15)

    # 2. Complaints count
    complaint_query = db.query(CitizenComplaint)
    if shop_name:
        complaint_query = complaint_query.filter(func.lower(CitizenComplaint.shop_name) == shop_name.lower())
    elif instrument_id:
        complaint_query = complaint_query.filter(CitizenComplaint.instrument_id == instrument_id)
    elif district:
        complaint_query = complaint_query.filter(func.lower(CitizenComplaint.district) == district.lower())

    total_complaints = complaint_query.count()
    factors["complaints_score"] = min(35, total_complaints * 10)

    # 3. Repeat complaints (more than 1 complaint)
    if total_complaints >= 2:
        factors["repeat_complaint_penalty"] = min(20, (total_complaints - 1) * 10)

    # 4. Overdue verification check
    if instrument_id:
        inst = db.get(Instrument, instrument_id)
        if inst and inst.next_verification_due_date:
            days = (inst.next_verification_due_date - date.today()).days
            if days < 0:
                factors["overdue_score"] = 15
            elif days <= 15:
                factors["overdue_score"] = 8

    # 5. Enforcement actions
    if instrument_id:
        enf_count = db.query(func.count(EnforcementRecord.id)).filter(EnforcementRecord.instrument_id == instrument_id).scalar() or 0
        factors["enforcement_penalty"] = min(20, enf_count * 10)

    total_score = min(100, sum(factors.values()))
    level = "CRITICAL" if total_score >= 75 else "HIGH" if total_score >= 50 else "MEDIUM" if total_score >= 25 else "LOW"

    return total_score, level, factors


def check_and_notify_due_dates(db: Session) -> dict:
    """Evaluate due dates and create reminder notifications for instrument owners."""
    today = date.today()
    instruments = db.query(Instrument).filter(Instrument.next_verification_due_date != None).all()
    count_notified = 0

    for inst in instruments:
        due = inst.next_verification_due_date
        if not due:
            continue
        days = (due - today).days

        # Check if overdue
        if days < 0 and inst.status != "EXPIRED":
            inst.status = "EXPIRED"
            db.add(
                Notification(
                    user_id=inst.owner_id,
                    title="Instrument Verification Expired",
                    message=f"Verification for instrument {inst.instrument_id} ({inst.instrument_type}) expired on {due}. Please apply for re-verification immediately.",
                    severity="CRITICAL",
                )
            )
            count_notified += 1
        elif 0 <= days <= 15:
            # 15-day urgent reminder
            db.add(
                Notification(
                    user_id=inst.owner_id,
                    title="Urgent: Verification Due Soon",
                    message=f"Verification for instrument {inst.instrument_id} is due in {days} days on {due}. Please schedule re-verification.",
                    severity="HIGH",
                )
            )
            count_notified += 1
        elif 15 < days <= 30:
            # 30-day reminder
            db.add(
                Notification(
                    user_id=inst.owner_id,
                    title="Upcoming Verification Due",
                    message=f"Verification for instrument {inst.instrument_id} is due on {due} (in {days} days).",
                    severity="NORMAL",
                )
            )
            count_notified += 1

    db.commit()
    return {"notified_count": count_notified}


def risk_for_instrument(db: Session, instrument: Instrument) -> tuple[int, str]:
    score, level, _ = calculate_establishment_risk(
        db,
        shop_name=instrument.owner_name,
        district=instrument.district,
        state=instrument.state,
        instrument_id=instrument.id,
    )
    return score, level



