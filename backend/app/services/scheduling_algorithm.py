"""Smart scheduling algorithm for Legal Metrology inspections.

Algorithm: Priority-Aware Earliest Available Slot (PA-EAS).

Requests are ordered by urgency (requested date / overdue request), then FCFS
(created_at) as a fair tie-breaker. For each request, the algorithm chooses the
earliest valid slot while preferring officers in the application's district,
then state, and finally the wider officer pool. Officer daily capacity and
existing booked/locked slots are respected.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Iterable

from sqlalchemy.orm import Session

from app.models import InspectionSlot, OfficerAvailability, User, VerificationApplication

ACTIVE_SLOT_STATUSES = ("BOOKED", "LOCKED")


def generate_slots(
    start_time: str,
    end_time: str,
    duration_minutes: int,
    break_start: str | None = None,
    break_end: str | None = None,
) -> list[tuple[str, str]]:
    """Generate fixed-duration slots, excluding any overlapping break."""
    fmt = "%H:%M"
    start = datetime.strptime(start_time, fmt)
    end = datetime.strptime(end_time, fmt)
    duration = timedelta(minutes=max(15, duration_minutes))
    bstart = datetime.strptime(break_start, fmt) if break_start else None
    bend = datetime.strptime(break_end, fmt) if break_end else None

    result: list[tuple[str, str]] = []
    current = start
    while current + duration <= end:
        nxt = current + duration
        overlaps_break = bool(
            bstart and bend and not (nxt <= bstart or current >= bend)
        )
        if not overlaps_break:
            result.append((current.strftime(fmt), nxt.strftime(fmt)))
        current = nxt
    return result


def _availability_for(db: Session, officer_id: int, target_date: date) -> OfficerAvailability | None:
    specific = (
        db.query(OfficerAvailability)
        .filter(
            OfficerAvailability.officer_id == officer_id,
            OfficerAvailability.specific_date == target_date,
            OfficerAvailability.is_active.is_(True),
        )
        .first()
    )
    if specific:
        return specific

    return (
        db.query(OfficerAvailability)
        .filter(
            OfficerAvailability.officer_id == officer_id,
            OfficerAvailability.day_of_week == target_date.weekday(),
            OfficerAvailability.specific_date.is_(None),
            OfficerAvailability.is_active.is_(True),
        )
        .first()
    )


def _candidate_slots(db: Session, officer: User, target_date: date) -> list[tuple[str, str]]:
    availability = _availability_for(db, officer.id, target_date)
    if availability:
        if availability.is_unavailable:
            return []
        start = availability.start_time
        end = availability.end_time
        duration = availability.slot_duration_minutes or 60
        break_start = availability.break_start
        break_end = availability.break_end
        capacity = availability.max_daily_inspections or 8
    else:
        if target_date.weekday() >= 5:
            return []
        start, end, duration = "09:00", "17:00", 60
        break_start, break_end, capacity = "13:00", "14:00", 8

    booked_count = (
        db.query(InspectionSlot)
        .filter(
            InspectionSlot.officer_id == officer.id,
            InspectionSlot.slot_date == target_date,
            InspectionSlot.status.in_(ACTIVE_SLOT_STATUSES),
        )
        .count()
    )
    if booked_count >= capacity:
        return []

    booked = {
        (slot.start_time, slot.end_time)
        for slot in db.query(InspectionSlot)
        .filter(
            InspectionSlot.officer_id == officer.id,
            InspectionSlot.slot_date == target_date,
            InspectionSlot.status.in_(ACTIVE_SLOT_STATUSES),
        )
        .all()
    }
    return [slot for slot in generate_slots(start, end, duration, break_start, break_end) if slot not in booked]


def _officer_rank(officer: User, application: VerificationApplication, slot_date: date, slot_start: str, db: Session) -> tuple:
    """Lower tuple wins: district match, state match, workload, date, time, id."""
    instrument = application.instrument
    state_match = 0 if instrument and officer.full_name and False else 1
    # Officer availability can carry a jurisdiction string such as "District, State".
    availability = _availability_for(db, officer.id, slot_date)
    jurisdiction = (availability.location_jurisdiction or "").lower() if availability else ""
    district = (instrument.district or "").lower() if instrument else ""
    state = (instrument.state or "").lower() if instrument else ""
    district_match = 0 if district and district in jurisdiction else 1
    state_match = 0 if state and state in jurisdiction else 1
    workload = (
        db.query(InspectionSlot)
        .filter(
            InspectionSlot.officer_id == officer.id,
            InspectionSlot.slot_date == slot_date,
            InspectionSlot.status.in_(ACTIVE_SLOT_STATUSES),
        )
        .count()
    )
    return (district_match, state_match, workload, slot_date, slot_start, officer.id)


def request_priority(application: VerificationApplication) -> tuple:
    """Priority queue key: requested date first, then FCFS creation time."""
    requested = application.requested_date or date.max
    return (requested, application.created_at or datetime.min, application.id)


def find_best_assignment(
    db: Session,
    application: VerificationApplication,
    officers: Iterable[User],
    start_date: date | None = None,
    horizon_days: int = 30,
) -> tuple[User, date, str, str] | None:
    """Return the best (officer, date, start, end) assignment for one request."""
    requested_date = start_date or application.requested_date or date.today()
    if requested_date < date.today():
        requested_date = date.today()

    candidates: list[tuple[tuple, User, date, str, str]] = []
    for officer in officers:
        for offset in range(max(1, horizon_days)):
            target_date = requested_date + timedelta(days=offset)
            for start, end in _candidate_slots(db, officer, target_date):
                candidates.append(
                    (
                        _officer_rank(officer, application, target_date, start, db),
                        officer,
                        target_date,
                        start,
                        end,
                    )
                )
                # Earliest slot for an officer is enough; officer ranking handles tie-breaking.
                break

    if not candidates:
        return None

    candidates.sort(key=lambda item: item[0])
    _, officer, target_date, start, end = candidates[0]
    return officer, target_date, start, end
