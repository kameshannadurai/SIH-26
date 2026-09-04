from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
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
from app.services.domain import audit, risk_for_instrument, route_verification_application
from app.utils.dependencies import require_role

router = APIRouter(prefix="/admin", tags=["Admin"])


class RoutingOverrideRequest(BaseModel):
    application_number: str
    target_officer_id: int
    reason: str = Field(min_length=3)


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN"))):
    instruments = db.query(Instrument).all()
    risks = [risk_for_instrument(db, x)[1] for x in instruments]
    total_complaints = db.query(func.count(CitizenComplaint.id)).scalar() or 0
    pending_complaints = db.query(func.count(CitizenComplaint.id)).filter(CitizenComplaint.status.in_(["SUBMITTED", "ASSIGNED", "IN_INVESTIGATION"])).scalar() or 0
    resolved_complaints = db.query(func.count(CitizenComplaint.id)).filter(CitizenComplaint.status.in_(["RESOLVED", "ACTION_TAKEN"])).scalar() or 0
    repeat_offenders_count = db.query(func.count(CitizenComplaint.id)).filter(CitizenComplaint.is_repeat_offender == True).scalar() or 0
    high_risk_shops_count = db.query(func.count(ShopRegistry.id)).filter(ShopRegistry.risk_score >= 50).scalar() or 0

    return {
        "total_instruments": len(instruments),
        "total_applications": db.query(func.count(VerificationApplication.id)).scalar() or 0,
        "pending_verifications": db.query(func.count(VerificationApplication.id)).filter(VerificationApplication.status.in_(["ASSIGNED", "IN_VERIFICATION", "SCHEDULED"])).scalar() or 0,
        "certificates_issued": db.query(func.count(VerificationCertificate.id)).scalar() or 0,
        "certificates_expiring": db.query(func.count(VerificationCertificate.id)).filter(VerificationCertificate.valid_until.between(date.today(), date.today() + timedelta(days=30))).scalar() or 0,
        "expired_certificates": db.query(func.count(VerificationCertificate.id)).filter(VerificationCertificate.valid_until < date.today()).scalar() or 0,
        "total_complaints": total_complaints,
        "pending_complaints": pending_complaints,
        "resolved_complaints": resolved_complaints,
        "repeat_offenders_count": repeat_offenders_count,
        "high_risk_shops_count": high_risk_shops_count,
        "risk_distribution": {x: risks.count(x) for x in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}},
    }


@router.get("/officers")
def list_officers(db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN"))):
    officers = db.query(User).filter(User.role.in_(["LMO", "GATC"]), User.is_active == True).all()
    results = []
    for off in officers:
        assigned_count = db.query(VerificationAssignment).filter(VerificationAssignment.assigned_officer_id == off.id, VerificationAssignment.status == "ASSIGNED").count()
        complaint_count = db.query(CitizenComplaint).filter(CitizenComplaint.assigned_officer_id == off.id, CitizenComplaint.status.in_(["ASSIGNED", "IN_INVESTIGATION"])).count()
        results.append({
            "id": off.id,
            "full_name": off.full_name,
            "email": off.email,
            "role": off.role,
            "state": off.state,
            "district": off.district,
            "organization_name": off.organization_name,
            "pending_verifications": assigned_count,
            "pending_complaints": complaint_count,
        })
    return results


@router.post("/override-routing")
def override_routing(
    payload: RoutingOverrideRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN"))
):
    app = db.query(VerificationApplication).filter_by(application_number=payload.application_number).first()
    if not app:
        raise HTTPException(404, "Application not found")

    target_officer = db.query(User).filter(User.id == payload.target_officer_id, User.is_active == True).first()
    if not target_officer:
        raise HTTPException(404, "Target officer not found")

    inst = db.get(Instrument, app.instrument_id)
    if not inst:
        raise HTTPException(404, "Instrument not found")

    decision = route_verification_application(
        db,
        application=app,
        instrument=inst,
        override_officer_id=target_officer.id,
        actor_id=user.id
    )

    db.add(
        Notification(
            user_id=target_officer.id,
            title="Assignment Manually Assigned by Admin",
            message=f"Application {app.application_number} reassigned to you by Administrator {user.full_name}. Reason: {payload.reason}",
            severity="HIGH"
        )
    )

    audit(
        db,
        user.id,
        "ADMIN_ROUTING_OVERRIDE",
        "application",
        app.application_number,
        new_value={
            "target_officer_id": target_officer.id,
            "target_officer_name": target_officer.full_name,
            "target_role": target_officer.role,
            "reason": payload.reason
        }
    )

    db.commit()
    return decision


@router.get("/audit-logs")
def audit_logs(db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN"))):
    return [
        {
            "id": x.id,
            "actor_id": x.actor_id,
            "action": x.action,
            "entity": x.entity,
            "entity_id": x.entity_id,
            "old_value": x.old_value,
            "new_value": x.new_value,
            "created_at": x.created_at
        }
        for x in db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(500).all()
    ]

