"""API endpoints for automatic multi-request inspection scheduling."""
from __future__ import annotations

from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import InspectionSlot, Notification, User, VerificationApplication, VerificationAssignment
from app.services.domain import audit, is_gatc_category, route_verification_application
from app.services.scheduling_algorithm import find_best_assignment
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/scheduling", tags=["Smart Scheduling"])


def _target_role(application: VerificationApplication) -> str:
    instrument = application.instrument
    if instrument and (is_gatc_category(instrument.category) or is_gatc_category(instrument.instrument_type)):
        return "GATC"
    return "LMO"


def _create_auto_slot(
    db: Session,
    application: VerificationApplication,
    officer: User,
    slot_date: date,
    start_time: str,
    end_time: str,
    actor_id: int,
) -> InspectionSlot:
    """Create a slot after the officer row is locked; re-check prevents races."""
    # PostgreSQL row lock serializes concurrent requests targeting the same officer.
    locked_officer = (
        db.query(User)
        .filter(User.id == officer.id, User.is_active.is_(True))
        .with_for_update()
        .first()
    )
    if not locked_officer:
        raise HTTPException(404, "Officer is no longer available")

    conflict = (
        db.query(InspectionSlot)
        .filter(
            InspectionSlot.officer_id == locked_officer.id,
            InspectionSlot.slot_date == slot_date,
            InspectionSlot.start_time == start_time,
            InspectionSlot.status.in_(["BOOKED", "LOCKED"]),
        )
        .first()
    )
    if conflict:
        raise HTTPException(409, "The selected slot was booked concurrently. Please retry automatic scheduling.")

    slot = InspectionSlot(
        officer_id=locked_officer.id,
        application_id=application.id,
        booked_by_id=actor_id,
        slot_date=slot_date,
        start_time=start_time,
        end_time=end_time,
        status="BOOKED",
        location=application.preferred_location,
        notes="Automatically scheduled by Priority-Aware Earliest Available Slot (PA-EAS).",
    )
    db.add(slot)

    scheduled_at = datetime.combine(slot_date, datetime.strptime(start_time, "%H:%M").time())
    assignment = db.query(VerificationAssignment).filter_by(application_id=application.id).first()
    if assignment:
        assignment.assigned_officer_id = locked_officer.id
        assignment.scheduled_at = scheduled_at
        assignment.status = "ASSIGNED"
    else:
        assignment = VerificationAssignment(
            application_id=application.id,
            assigned_officer_id=locked_officer.id,
            centre_id=locked_officer.id if locked_officer.role == "GATC" else None,
            scheduled_at=scheduled_at,
            location=application.preferred_location,
            priority="NORMAL",
            status="ASSIGNED",
            created_by_id=actor_id,
        )
        db.add(assignment)

    application.status = "SCHEDULED"
    db.add(Notification(
        user_id=locked_officer.id,
        title="Inspection Automatically Scheduled",
        message=f"Application {application.application_number} scheduled for {slot_date} {start_time}-{end_time}.",
        severity="NORMAL",
    ))
    if application.applicant_id:
        db.add(Notification(
            user_id=application.applicant_id,
            title="Verification Appointment Scheduled",
            message=f"Your application {application.application_number} is scheduled for {slot_date} {start_time}-{end_time} with {locked_officer.full_name}.",
            severity="NORMAL",
        ))

    audit(
        db,
        actor_id,
        "AUTO_APPOINTMENT_SCHEDULED",
        "slot",
        application.application_number,
        new_value={
            "algorithm": "PA-EAS",
            "officer_id": locked_officer.id,
            "officer_name": locked_officer.full_name,
            "slot_date": slot_date.isoformat(),
            "start_time": start_time,
            "end_time": end_time,
        },
    )
    return slot


@router.post("/auto-schedule/{application_number}")
def auto_schedule_application(
    application_number: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Automatically assign one business request to the best eligible officer and slot."""
    application = (
        db.query(VerificationApplication)
        .filter(VerificationApplication.application_number == application_number)
        .first()
    )
    if not application:
        raise HTTPException(404, "Application not found")
    if user.role == "BUSINESS" and application.applicant_id != user.id:
        raise HTTPException(403, "Not permitted")

    existing = (
        db.query(InspectionSlot)
        .filter(
            InspectionSlot.application_id == application.id,
            InspectionSlot.status.in_(["BOOKED", "LOCKED"]),
        )
        .first()
    )
    if existing:
        return {"success": True, "algorithm": "PA-EAS", "status": "ALREADY_SCHEDULED", "slot_id": existing.id}

    # Route first when an officer has not yet been assigned.
    if not db.query(VerificationAssignment).filter_by(application_id=application.id).first():
        route_verification_application(db, application, application.instrument, actor_id=user.id)
        db.flush()

    role = _target_role(application)
    officers = (
        db.query(User)
        .filter(User.role == role, User.is_active.is_(True))
        .all()
    )
    if not officers and role == "GATC":
        officers = db.query(User).filter(User.role == "LMO", User.is_active.is_(True)).all()
        role = "LMO"
    if not officers:
        db.rollback()
        raise HTTPException(409, f"No active {role} officers are available for automatic scheduling")

    choice = find_best_assignment(db, application, officers, start_date=application.requested_date or date.today())
    if not choice:
        db.rollback()
        raise HTTPException(409, "No available inspection slot found within the scheduling horizon")

    officer, slot_date, start_time, end_time = choice
    try:
        slot = _create_auto_slot(db, application, officer, slot_date, start_time, end_time, user.id)
        db.commit()
        db.refresh(slot)
    except HTTPException:
        db.rollback()
        raise

    return {
        "success": True,
        "algorithm": "PA-EAS",
        "status": "SCHEDULED",
        "application_number": application.application_number,
        "officer_id": officer.id,
        "officer_name": officer.full_name,
        "officer_role": officer.role,
        "slot_id": slot.id,
        "slot_date": slot.slot_date,
        "start_time": slot.start_time,
        "end_time": slot.end_time,
        "message": "Request automatically scheduled using the earliest valid slot with priority, jurisdiction, capacity and collision checks.",
    }


@router.post("/auto-schedule/pending")
def auto_schedule_pending(
    limit: int = 50,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Schedule a batch of pending requests in priority order; intended for ADMIN operations."""
    if user.role != "ADMIN":
        raise HTTPException(403, "Admin access required")
    limit = max(1, min(limit, 100))

    pending = (
        db.query(VerificationApplication)
        .filter(VerificationApplication.status.in_(["SUBMITTED", "ASSIGNED"]))
        .order_by(VerificationApplication.requested_date.asc(), VerificationApplication.created_at.asc(), VerificationApplication.id.asc())
        .limit(limit)
        .all()
    )

    results = []
    for application in pending:
        try:
            existing = (
                db.query(InspectionSlot)
                .filter(InspectionSlot.application_id == application.id, InspectionSlot.status.in_(["BOOKED", "LOCKED"]))
                .first()
            )
            if existing:
                results.append({"application_number": application.application_number, "status": "ALREADY_SCHEDULED", "slot_id": existing.id})
                continue

            if not db.query(VerificationAssignment).filter_by(application_id=application.id).first():
                route_verification_application(db, application, application.instrument, actor_id=user.id)
                db.flush()

            role = _target_role(application)
            officers = db.query(User).filter(User.role == role, User.is_active.is_(True)).all()
            if not officers and role == "GATC":
                officers = db.query(User).filter(User.role == "LMO", User.is_active.is_(True)).all()
            choice = find_best_assignment(db, application, officers, start_date=application.requested_date or date.today()) if officers else None
            if not choice:
                results.append({"application_number": application.application_number, "status": "NO_SLOT"})
                continue

            officer, slot_date, start_time, end_time = choice
            slot = _create_auto_slot(db, application, officer, slot_date, start_time, end_time, user.id)
            results.append({
                "application_number": application.application_number,
                "status": "SCHEDULED",
                "slot_id": slot.id,
                "officer_id": officer.id,
                "slot_date": slot_date,
                "start_time": start_time,
                "end_time": end_time,
            })
            db.commit()
        except Exception as exc:
            db.rollback()
            results.append({"application_number": application.application_number, "status": "FAILED", "message": str(exc)})

    return {"success": True, "algorithm": "PA-EAS", "processed": len(results), "results": results}
