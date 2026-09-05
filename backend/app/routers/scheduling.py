from __future__ import annotations

from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    InspectionSlot,
    Instrument,
    Notification,
    OfficerAvailability,
    User,
    VerificationApplication,
    VerificationAssignment,
)
from app.schemas.smart_ecosystem import (
    AvailableSlotOut,
    OfficerAvailabilityCreate,
    OfficerAvailabilityOut,
    SlotBookingRequest,
    SlotBookingResponse,
    SlotRescheduleRequest,
)
from app.services.domain import audit
from app.utils.dependencies import get_current_user, require_role

router = APIRouter(prefix="/scheduling", tags=["Smart Scheduling"])


# ==============================================================================
# OFFICER AVAILABILITY CONFIGURATION
# ==============================================================================

@router.post("/availability", response_model=OfficerAvailabilityOut, status_code=status.HTTP_201_CREATED)
def set_officer_availability(
    payload: OfficerAvailabilityCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN"))
):
    """Centralized schedule management: only ADMIN can configure or edit officer availability hours."""
    target_officer_id = payload.officer_id or user.id
    target_officer = db.query(User).filter_by(id=target_officer_id).first()
    if not target_officer or target_officer.role not in {"LMO", "GATC"}:
        raise HTTPException(400, "Valid LMO or GATC officer must be specified for availability configuration")

    # If specific_date is provided, check if override exists
    existing = None
    if payload.specific_date:
        existing = db.query(OfficerAvailability).filter(
            OfficerAvailability.officer_id == target_officer_id,
            OfficerAvailability.specific_date == payload.specific_date
        ).first()
    elif payload.day_of_week is not None:
        existing = db.query(OfficerAvailability).filter(
            OfficerAvailability.officer_id == target_officer_id,
            OfficerAvailability.day_of_week == payload.day_of_week,
            OfficerAvailability.specific_date == None
        ).first()

    fields_to_update = payload.model_dump(exclude={"officer_id"})
    if existing:
        for k, v in fields_to_update.items():
            setattr(existing, k, v)
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing

    availability = OfficerAvailability(
        officer_id=target_officer_id,
        **fields_to_update
    )
    db.add(availability)
    db.commit()
    db.refresh(availability)
    return availability


@router.get("/availability", response_model=list[OfficerAvailabilityOut])
def get_officer_availability(
    officer_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    target_officer_id = officer_id or user.id
    if user.role == "BUSINESS" and not officer_id:
        raise HTTPException(400, "officer_id required")

    return db.query(OfficerAvailability).filter(
        OfficerAvailability.officer_id == target_officer_id,
        OfficerAvailability.is_active == True
    ).all()


# ==============================================================================
# AVAILABLE SLOTS QUERY & COLLISION-PREVENTED BOOKING
# ==============================================================================

def generate_day_slots(start_str: str, end_str: str, duration_min: int, break_start_str: str | None, break_end_str: str | None) -> list[tuple[str, str]]:
    """Generate (start_time, end_time) slot strings for a working window excluding breaks."""
    fmt = "%H:%M"
    start_dt = datetime.strptime(start_str, fmt)
    end_dt = datetime.strptime(end_str, fmt)
    delta = timedelta(minutes=duration_min)

    break_start_dt = datetime.strptime(break_start_str, fmt) if break_start_str else None
    break_end_dt = datetime.strptime(break_end_str, fmt) if break_end_str else None

    slots = []
    curr = start_dt
    while curr + delta <= end_dt:
        nxt = curr + delta
        # Check break overlap
        in_break = False
        if break_start_dt and break_end_dt:
            if not (nxt <= break_start_dt or curr >= break_end_dt):
                in_break = True
        if not in_break:
            slots.append((curr.strftime("%H:%M"), nxt.strftime("%H:%M")))
        curr = nxt
    return slots


@router.get("/slots/available", response_model=list[AvailableSlotOut])
def get_available_slots(
    officer_id: int = Query(...),
    target_date: date = Query(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    officer = db.query(User).filter(User.id == officer_id, User.is_active == True).first()
    if not officer:
        raise HTTPException(404, "Officer not found")

    # 1. Check specific date availability override
    avail = db.query(OfficerAvailability).filter(
        OfficerAvailability.officer_id == officer_id,
        OfficerAvailability.specific_date == target_date,
        OfficerAvailability.is_active == True
    ).first()

    # 2. Fall back to recurring day of week
    if not avail:
        day_of_week = target_date.weekday()  # 0=Monday, 6=Sunday
        avail = db.query(OfficerAvailability).filter(
            OfficerAvailability.officer_id == officer_id,
            OfficerAvailability.day_of_week == day_of_week,
            OfficerAvailability.specific_date == None,
            OfficerAvailability.is_active == True
        ).first()

    # Default working hours if officer hasn't explicitly set schedule (Mon-Fri 09:00-17:00)
    if not avail:
        if target_date.weekday() in {5, 6}:  # Saturday/Sunday off by default
            return []
        start_time_str = "09:00"
        end_time_str = "17:00"
        duration_min = 60
        break_start = "13:00"
        break_end = "14:00"
        is_unavail = False
    else:
        if avail.is_unavailable:
            return []
        start_time_str = avail.start_time
        end_time_str = avail.end_time
        duration_min = avail.slot_duration_minutes or 60
        break_start = avail.break_start
        break_end = avail.break_end
        is_unavail = avail.is_unavailable

    candidate_slots = generate_day_slots(start_time_str, end_time_str, duration_min, break_start, break_end)

    # Fetch already booked slots for this officer and date
    booked_slots = db.query(InspectionSlot).filter(
        InspectionSlot.officer_id == officer_id,
        InspectionSlot.slot_date == target_date,
        InspectionSlot.status.in_(["BOOKED", "LOCKED"])
    ).all()

    booked_times = {(s.start_time, s.end_time) for s in booked_slots}

    results = []
    for s_start, s_end in candidate_slots:
        is_booked = (s_start, s_end) in booked_times
        results.append(
            AvailableSlotOut(
                officer_id=officer.id,
                officer_name=officer.full_name,
                officer_role=officer.role,
                slot_date=target_date,
                start_time=s_start,
                end_time=s_end,
                status="BOOKED" if is_booked else "AVAILABLE",
                is_available=not is_booked
            )
        )

    return results


@router.post("/book", response_model=SlotBookingResponse)
def book_inspection_slot(
    payload: SlotBookingRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    application = db.query(VerificationApplication).filter_by(application_number=payload.application_number).first()
    if not application:
        raise HTTPException(404, "Application not found")

    if user.role == "BUSINESS" and application.applicant_id != user.id:
        raise HTTPException(403, "Not permitted to book for another business's application")

    officer = db.query(User).filter(User.id == payload.officer_id, User.is_active == True).first()
    if not officer:
        raise HTTPException(404, "Officer not found")

    # Double Booking / Collision Prevention: Check if slot is already occupied
    conflict = db.query(InspectionSlot).filter(
        InspectionSlot.officer_id == officer.id,
        InspectionSlot.slot_date == payload.slot_date,
        InspectionSlot.start_time == payload.start_time,
        InspectionSlot.status.in_(["BOOKED", "LOCKED"])
    ).first()

    if conflict:
        raise HTTPException(409, f"The selected time slot ({payload.start_time}-{payload.end_time} on {payload.slot_date}) has just been booked. Please pick another available slot.")

    # Cancel previous active slot for this application if rescheduling
    prev_slot = db.query(InspectionSlot).filter(
        InspectionSlot.application_id == application.id,
        InspectionSlot.status.in_(["BOOKED", "LOCKED"])
    ).first()
    if prev_slot:
        prev_slot.status = "CANCELLED"

    # Create new booked slot
    slot = InspectionSlot(
        officer_id=officer.id,
        application_id=application.id,
        booked_by_id=user.id,
        slot_date=payload.slot_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        status="BOOKED",
        location=payload.location or application.preferred_location,
        notes=payload.notes
    )
    db.add(slot)

    # Update application & assignment
    combined_scheduled_dt = datetime.combine(
        payload.slot_date,
        datetime.strptime(payload.start_time, "%H:%M").time()
    )
    application.status = "SCHEDULED"

    assignment = db.query(VerificationAssignment).filter_by(application_id=application.id).first()
    if assignment:
        assignment.scheduled_at = combined_scheduled_dt
        assignment.assigned_officer_id = officer.id
        assignment.status = "ASSIGNED"
    else:
        assignment = VerificationAssignment(
            application_id=application.id,
            assigned_officer_id=officer.id,
            centre_id=officer.id if officer.role == "GATC" else None,
            scheduled_at=combined_scheduled_dt,
            location=slot.location,
            priority="NORMAL",
            status="ASSIGNED",
            created_by_id=user.id
        )
        db.add(assignment)

    # Notify Officer
    db.add(
        Notification(
            user_id=officer.id,
            title="Inspection Appointment Confirmed",
            message=f"Application {application.application_number} has booked an appointment on {payload.slot_date} from {payload.start_time} to {payload.end_time}.",
            severity="NORMAL"
        )
    )

    # Notify Business Applicant
    if application.applicant_id:
        db.add(
            Notification(
                user_id=application.applicant_id,
                title="Appointment Slot Confirmed",
                message=f"Your verification appointment for {application.application_number} is confirmed for {payload.slot_date} ({payload.start_time} - {payload.end_time}) with Officer {officer.full_name}.",
                severity="NORMAL"
            )
        )

    audit(
        db,
        user.id,
        "APPOINTMENT_BOOKED",
        "slot",
        application.application_number,
        new_value={
            "slot_date": payload.slot_date.isoformat(),
            "start_time": payload.start_time,
            "end_time": payload.end_time,
            "officer_id": officer.id,
            "officer_name": officer.full_name
        }
    )

    db.commit()
    db.refresh(slot)

    return SlotBookingResponse(
        success=True,
        slot_id=slot.id,
        application_number=application.application_number,
        officer_name=officer.full_name,
        slot_date=slot.slot_date,
        start_time=slot.start_time,
        end_time=slot.end_time,
        status="BOOKED",
        message="Appointment successfully booked and verified."
    )


@router.post("/slots/{slot_id}/reschedule", response_model=SlotBookingResponse)
def reschedule_slot(
    slot_id: int,
    payload: SlotRescheduleRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    slot = db.get(InspectionSlot, slot_id)
    if not slot:
        raise HTTPException(404, "Slot not found")

    if user.role == "BUSINESS" and slot.booked_by_id != user.id:
        raise HTTPException(403, "Not permitted")

    # Check collision for new slot
    conflict = db.query(InspectionSlot).filter(
        InspectionSlot.officer_id == slot.officer_id,
        InspectionSlot.slot_date == payload.new_date,
        InspectionSlot.start_time == payload.new_start_time,
        InspectionSlot.status.in_(["BOOKED", "LOCKED"]),
        InspectionSlot.id != slot.id
    ).first()

    if conflict:
        raise HTTPException(409, "The requested new slot is already booked. Please choose another time.")

    old_date = slot.slot_date
    old_time = slot.start_time
    slot.slot_date = payload.new_date
    slot.start_time = payload.new_start_time
    slot.end_time = payload.new_end_time
    slot.notes = f"{slot.notes or ''}\nRescheduled: {payload.reason or 'User requested'}".strip()
    slot.updated_at = datetime.utcnow()

    # Update assignment
    combined_dt = datetime.combine(payload.new_date, datetime.strptime(payload.new_start_time, "%H:%M").time())
    assignment = db.query(VerificationAssignment).filter_by(application_id=slot.application_id).first()
    if assignment:
        assignment.scheduled_at = combined_dt

    officer = db.get(User, slot.officer_id)
    app = db.get(VerificationApplication, slot.application_id) if slot.application_id else None

    # Notify officer and applicant
    if officer:
        db.add(
            Notification(
                user_id=officer.id,
                title="Appointment Rescheduled",
                message=f"Appointment for {app.application_number if app else 'Inspection'} moved from {old_date} {old_time} to {payload.new_date} {payload.new_start_time}.",
                severity="NORMAL"
            )
        )

    audit(
        db,
        user.id,
        "APPOINTMENT_RESCHEDULED",
        "slot",
        str(slot.id),
        old_value={"date": old_date.isoformat(), "time": old_time},
        new_value={"date": payload.new_date.isoformat(), "time": payload.new_start_time, "reason": payload.reason}
    )

    db.commit()
    db.refresh(slot)

    return SlotBookingResponse(
        success=True,
        slot_id=slot.id,
        application_number=app.application_number if app else "N/A",
        officer_name=officer.full_name if officer else "Officer",
        slot_date=slot.slot_date,
        start_time=slot.start_time,
        end_time=slot.end_time,
        status="BOOKED",
        message="Appointment successfully rescheduled."
    )


@router.post("/slots/{slot_id}/cancel")
def cancel_slot(
    slot_id: int,
    reason: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    slot = db.get(InspectionSlot, slot_id)
    if not slot:
        raise HTTPException(404, "Slot not found")

    if user.role == "BUSINESS" and slot.booked_by_id != user.id:
        raise HTTPException(403, "Not permitted")

    slot.status = "CANCELLED"
    slot.notes = f"{slot.notes or ''}\nCancelled: {reason or 'No reason provided'}".strip()

    if slot.application_id:
        app = db.get(VerificationApplication, slot.application_id)
        if app and app.status == "SCHEDULED":
            app.status = "ASSIGNED"

    audit(
        db,
        user.id,
        "APPOINTMENT_CANCELLED",
        "slot",
        str(slot.id),
        new_value={"reason": reason}
    )

    db.commit()
    return {"success": True, "message": "Appointment cancelled"}


@router.get("/my-appointments")
def get_my_appointments(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if user.role == "BUSINESS":
        slots = db.query(InspectionSlot).filter(
            InspectionSlot.booked_by_id == user.id,
            InspectionSlot.status == "BOOKED"
        ).order_by(InspectionSlot.slot_date.asc()).all()
    elif user.role in {"LMO", "GATC"}:
        slots = db.query(InspectionSlot).filter(
            InspectionSlot.officer_id == user.id,
            InspectionSlot.status == "BOOKED"
        ).order_by(InspectionSlot.slot_date.asc()).all()
    else:
        slots = db.query(InspectionSlot).filter(
            InspectionSlot.status == "BOOKED"
        ).order_by(InspectionSlot.slot_date.asc()).limit(50).all()

    results = []
    for s in slots:
        app = db.get(VerificationApplication, s.application_id) if s.application_id else None
        inst = db.get(Instrument, app.instrument_id) if app else None
        officer = db.get(User, s.officer_id)
        results.append({
            "slot_id": s.id,
            "slot_date": s.slot_date,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "status": s.status,
            "location": s.location,
            "notes": s.notes,
            "application_number": app.application_number if app else None,
            "instrument_type": inst.instrument_type if inst else None,
            "officer_name": officer.full_name if officer else "Officer",
            "officer_role": officer.role if officer else "LMO",
        })

    return results
