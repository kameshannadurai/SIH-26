from __future__ import annotations

import math
import secrets
from datetime import datetime, timedelta
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    CitizenComplaint,
    ComplaintEvidence,
    ComplaintTimeline,
    Instrument,
    Notification,
    OTPVerification,
    ShopRegistry,
    User,
    VerificationCertificate,
)
from app.schemas.smart_ecosystem import (
    ComplaintActionRequest,
    ComplaintAssignRequest,
    ComplaintCreate,
    ComplaintOut,
    ComplaintTrackOut,
    OTPSendRequest,
    OTPSendResponse,
    OTPVerifyRequest,
    OTPVerifyResponse,
    ShopSearchOut,
)
from app.services.domain import audit, calculate_establishment_risk, official_number
from app.utils.dependencies import get_current_user, require_role

router = APIRouter(prefix="/complaints", tags=["Citizen Complaints"])


# ==============================================================================
# OTP CITIZEN VERIFICATION
# ==============================================================================

@router.post("/otp/send", response_model=OTPSendResponse)
def send_citizen_otp(payload: OTPSendRequest, db: Session = Depends(get_db)):
    # Clean phone
    phone = payload.phone_number.strip().replace(" ", "").replace("-", "")
    if len(phone) < 10:
        raise HTTPException(400, "Valid 10-digit mobile number required")

    # Generate 6-digit random OTP
    otp_code = f"{secrets.randbelow(900000) + 100000}"
    verification_token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    # Invalidate previous unverified tokens for this phone
    db.query(OTPVerification).filter(
        OTPVerification.phone_number == phone,
        OTPVerification.is_verified == False
    ).delete()

    otp_rec = OTPVerification(
        phone_number=phone,
        otp_code=otp_code,
        verification_token=verification_token,
        expires_at=expires_at,
        is_verified=False,
        attempts_count=0
    )
    db.add(otp_rec)
    db.commit()

    return OTPSendResponse(
        success=True,
        message=f"OTP successfully sent to {phone[:2]}******{phone[-2:]}",
        phone_number=phone,
        verification_token=verification_token,
        expires_in_seconds=600,
        demo_otp_code=otp_code,  # Facilitates seamless immediate verification
    )


@router.post("/otp/verify", response_model=OTPVerifyResponse)
def verify_citizen_otp(payload: OTPVerifyRequest, db: Session = Depends(get_db)):
    rec = db.query(OTPVerification).filter_by(verification_token=payload.verification_token).first()
    if not rec:
        raise HTTPException(404, "Invalid or expired verification session")

    if rec.expires_at < datetime.utcnow():
        raise HTTPException(400, "OTP has expired. Please request a new OTP.")

    if rec.attempts_count >= 5:
        raise HTTPException(429, "Too many failed attempts. Please request a new OTP.")

    rec.attempts_count += 1

    if rec.otp_code != payload.otp_code.strip():
        db.commit()
        raise HTTPException(400, "Invalid OTP code. Please try again.")

    rec.is_verified = True
    db.commit()

    return OTPVerifyResponse(
        success=True,
        message="Phone number verified successfully",
        phone_number=rec.phone_number,
        is_verified=True,
        verified_token=rec.verification_token,
    )


# ==============================================================================
# COMPLAINT CREATION & PUBLIC TRACKING
# ==============================================================================

@router.post("", response_model=ComplaintOut, status_code=status.HTTP_201_CREATED)
def submit_citizen_complaint(payload: ComplaintCreate, db: Session = Depends(get_db)):
    # 1. Verify OTP token
    otp_rec = db.query(OTPVerification).filter_by(
        verification_token=payload.verification_token,
        is_verified=True
    ).first()
    if not otp_rec:
        raise HTTPException(403, "Mobile verification required before submitting a complaint")

    # 2. Check if linked via QR token or instrument string
    instrument_id = None
    instrument_cat = payload.instrument_category
    if payload.qr_token_used:
        cert = db.query(VerificationCertificate).filter_by(qr_token=payload.qr_token_used).first()
        if cert:
            instrument_id = cert.instrument_id
            inst = db.get(Instrument, cert.instrument_id)
            if inst and not instrument_cat:
                instrument_cat = inst.category or inst.instrument_type
    elif payload.instrument_id_str:
        inst = db.query(Instrument).filter_by(instrument_id=payload.instrument_id_str).first()
        if inst:
            instrument_id = inst.id
            if not instrument_cat:
                instrument_cat = inst.category or inst.instrument_type

    # 3. Check for shop in ShopRegistry or create entry
    shop = db.query(ShopRegistry).filter(
        func.lower(ShopRegistry.shop_name) == payload.shop_name.lower(),
        func.lower(ShopRegistry.district) == payload.district.lower(),
        func.lower(ShopRegistry.state) == payload.state.lower()
    ).first()

    if not shop:
        shop = ShopRegistry(
            shop_name=payload.shop_name,
            address=payload.shop_address,
            state=payload.state,
            district=payload.district,
            latitude=payload.latitude,
            longitude=payload.longitude,
            complaint_count=1,
            violation_count=0,
            risk_score=20,
            is_flagged=False
        )
        db.add(shop)
        db.flush()
    else:
        shop.complaint_count += 1

    # 4. Check for repeat complaints against this shop
    past_complaints_count = db.query(CitizenComplaint).filter(
        func.lower(CitizenComplaint.shop_name) == payload.shop_name.lower(),
        func.lower(CitizenComplaint.district) == payload.district.lower()
    ).count()

    is_repeat = past_complaints_count >= 1

    # 5. Multi-factor Risk Calculation
    risk_score, risk_level, _ = calculate_establishment_risk(
        db,
        shop_name=payload.shop_name,
        district=payload.district,
        state=payload.state,
        instrument_id=instrument_id
    )
    if is_repeat:
        risk_score = min(100, risk_score + 25)
        shop.is_flagged = True

    shop.risk_score = risk_score

    # 6. Automatic Assignment to Regional LMO by jurisdiction
    assigned_officer = (
        db.query(User)
        .filter(
            User.role == "LMO",
            User.is_active == True,
            func.lower(User.district) == payload.district.lower(),
            func.lower(User.state) == payload.state.lower()
        )
        .first()
    )
    if not assigned_officer:
        assigned_officer = (
            db.query(User)
            .filter(
                User.role == "LMO",
                User.is_active == True,
                func.lower(User.state) == payload.state.lower()
            )
            .first()
        )
    if not assigned_officer:
        assigned_officer = db.query(User).filter(User.role == "LMO", User.is_active == True).first()

    # 7. Generate Complaint ID (e.g. COMP-TN-2026-000001)
    complaint_num = official_number(db, CitizenComplaint, "complaint_number", "COMP", payload.state)

    complaint = CitizenComplaint(
        complaint_number=complaint_num,
        citizen_name=payload.citizen_name,
        id_reference_token=payload.id_reference,
        verified_phone=payload.verified_phone,
        shop_name=payload.shop_name,
        shop_address=payload.shop_address,
        state=payload.state,
        district=payload.district,
        latitude=payload.latitude,
        longitude=payload.longitude,
        instrument_id=instrument_id,
        instrument_category=instrument_cat,
        complaint_category=payload.complaint_category,
        violation_type=payload.violation_type,
        description=payload.description,
        severity=payload.severity.upper(),
        status="ASSIGNED" if assigned_officer else "SUBMITTED",
        assigned_officer_id=assigned_officer.id if assigned_officer else None,
        is_repeat_offender=is_repeat,
        risk_score=risk_score,
        entry_method=payload.entry_method,
        qr_token_used=payload.qr_token_used,
    )
    db.add(complaint)
    db.flush()

    # 8. Add initial timeline entry
    timeline_entry = ComplaintTimeline(
        complaint_id=complaint.id,
        action="COMPLAINT_SUBMITTED",
        actor_name=payload.citizen_name,
        actor_role="CITIZEN",
        notes=f"Complaint filed via {payload.entry_method}. Violation: {payload.violation_type}",
        new_status=complaint.status,
    )
    db.add(timeline_entry)

    # 9. Notify Officer & Admins
    if assigned_officer:
        db.add(
            Notification(
                user_id=assigned_officer.id,
                title="New Citizen Complaint Assigned",
                message=f"Complaint {complaint_num} filed against '{payload.shop_name}' in {payload.district}. Severity: {payload.severity}{' [REPEAT OFFENDER]' if is_repeat else ''}.",
                severity="HIGH" if is_repeat else "NORMAL"
            )
        )

    # Also notify admins if high severity or repeat offender
    if is_repeat or payload.severity.upper() in {"HIGH", "CRITICAL"}:
        admins = db.query(User).filter(User.role == "ADMIN", User.is_active == True).all()
        for adm in admins:
            db.add(
                Notification(
                    user_id=adm.id,
                    title="Alert: High-Risk / Repeat Complaint Filed",
                    message=f"High-risk complaint {complaint_num} filed against '{payload.shop_name}' ({payload.district}, {payload.state}). Risk Score: {risk_score}/100.",
                    severity="CRITICAL"
                )
            )

    audit(
        db,
        None,
        "COMPLAINT_FILED",
        "complaint",
        complaint.complaint_number,
        new_value={
            "shop_name": payload.shop_name,
            "district": payload.district,
            "violation": payload.violation_type,
            "assigned_officer_id": assigned_officer.id if assigned_officer else None,
            "risk_score": risk_score,
            "is_repeat": is_repeat
        }
    )

    db.commit()
    db.refresh(complaint)
    return complaint


@router.post("/{complaint_number}/evidence", status_code=status.HTTP_201_CREATED)
async def upload_complaint_evidence(
    complaint_number: str,
    file: UploadFile = File(...),
    evidence_type: str = Form("PHOTO"),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    db: Session = Depends(get_db)
):
    complaint = db.query(CitizenComplaint).filter_by(complaint_number=complaint_number).first()
    if not complaint:
        raise HTTPException(404, "Complaint not found")

    allowed_types = {"image/jpeg", "image/png", "application/pdf", "video/mp4"}
    if file.content_type not in allowed_types:
        raise HTTPException(415, "Supported formats: JPEG, PNG, PDF, MP4")

    content = await file.read()
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(413, "File exceeds 15 MB limit")

    ext = Path(file.filename or "evidence.jpg").suffix.lower()
    if not ext:
        ext = ".jpg" if "image" in file.content_type else ".pdf"
    
    unique_name = f"{uuid4().hex}{ext}"
    base_dir = Path(__file__).resolve().parents[3] / "storage" / "complaint-evidence"
    base_dir.mkdir(parents=True, exist_ok=True)
    file_path = base_dir / unique_name
    file_path.write_bytes(content)

    evidence = ComplaintEvidence(
        complaint_id=complaint.id,
        storage_path=f"storage/complaint-evidence/{unique_name}",
        filename=file.filename or unique_name,
        content_type=file.content_type,
        evidence_type=evidence_type,
        file_size=len(content),
        latitude=latitude,
        longitude=longitude
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)

    return {"id": evidence.id, "filename": evidence.filename, "storage_path": evidence.storage_path}


@router.get("/track/{complaint_number}", response_model=ComplaintTrackOut)
def track_citizen_complaint(
    complaint_number: str,
    phone: str | None = None,
    db: Session = Depends(get_db)
):
    query = db.query(CitizenComplaint).filter(CitizenComplaint.complaint_number.ilike(complaint_number.strip()))
    if phone:
        clean_phone = phone.strip().replace(" ", "").replace("-", "")
        query = query.filter(CitizenComplaint.verified_phone.endswith(clean_phone[-10:]))

    complaint = query.first()
    if not complaint:
        raise HTTPException(404, "Complaint not found or verification phone mismatch")

    return complaint


# ==============================================================================
# OFFICER & ADMIN COMPLAINT MANAGEMENT
# ==============================================================================

@router.get("", response_model=list[ComplaintOut])
def list_complaints(
    status_filter: str | None = Query(None, alias="status"),
    district_filter: str | None = Query(None, alias="district"),
    q: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("LMO", "GATC", "ADMIN"))
):
    query = db.query(CitizenComplaint).order_by(CitizenComplaint.created_at.desc())

    if user.role == "LMO":
        # Filter by officer's district / state or assignments
        query = query.filter(
            or_(
                CitizenComplaint.assigned_officer_id == user.id,
                func.lower(CitizenComplaint.district) == (user.district or "").lower(),
                func.lower(CitizenComplaint.state) == (user.state or "").lower()
            )
        )
    elif user.role == "GATC":
        # GATC see complaints linked to GATC categories or assigned to their centre
        query = query.filter(
            or_(
                CitizenComplaint.assigned_officer_id == user.id,
                func.lower(CitizenComplaint.state) == (user.state or "").lower()
            )
        )

    if status_filter:
        query = query.filter(CitizenComplaint.status == status_filter.upper())
    if district_filter:
        query = query.filter(func.lower(CitizenComplaint.district) == district_filter.lower())
    if q:
        query = query.filter(
            or_(
                CitizenComplaint.complaint_number.ilike(f"%{q}%"),
                CitizenComplaint.shop_name.ilike(f"%{q}%"),
                CitizenComplaint.violation_type.ilike(f"%{q}%")
            )
        )

    return query.all()


@router.get("/{complaint_number}", response_model=ComplaintOut)
def get_complaint_detail(
    complaint_number: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("LMO", "GATC", "ADMIN"))
):
    complaint = db.query(CitizenComplaint).filter_by(complaint_number=complaint_number).first()
    if not complaint:
        raise HTTPException(404, "Complaint not found")
    return complaint


@router.post("/{complaint_number}/action", response_model=ComplaintOut)
def record_complaint_action(
    complaint_number: str,
    payload: ComplaintActionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("LMO", "GATC", "ADMIN"))
):
    complaint = db.query(CitizenComplaint).filter_by(complaint_number=complaint_number).first()
    if not complaint:
        raise HTTPException(404, "Complaint not found")

    old_status = complaint.status
    complaint.status = payload.status.upper()
    complaint.action_taken = payload.action_taken
    complaint.resolution_notes = payload.resolution_notes
    complaint.updated_at = datetime.utcnow()

    # If action was taken / violation verified, update shop registry count
    if payload.status.upper() in {"ACTION_TAKEN", "RESOLVED"}:
        shop = db.query(ShopRegistry).filter(
            func.lower(ShopRegistry.shop_name) == complaint.shop_name.lower(),
            func.lower(ShopRegistry.district) == complaint.district.lower()
        ).first()
        if shop:
            shop.violation_count += 1
            shop.last_inspection_date = date.today()

    # Timeline entry
    timeline = ComplaintTimeline(
        complaint_id=complaint.id,
        action=f"ACTION_RECORDED_{payload.status.upper()}",
        actor_id=user.id,
        actor_name=user.full_name,
        actor_role=user.role,
        notes=f"Action: {payload.action_taken}. Notes: {payload.resolution_notes or 'None'}",
        old_status=old_status,
        new_status=complaint.status
    )
    db.add(timeline)

    audit(
        db,
        user.id,
        "COMPLAINT_ACTION_TAKEN",
        "complaint",
        complaint.complaint_number,
        old_value={"status": old_status},
        new_value={"status": complaint.status, "action": payload.action_taken}
    )

    db.commit()
    db.refresh(complaint)
    return complaint


@router.post("/{complaint_number}/assign", response_model=ComplaintOut)
def assign_complaint_officer(
    complaint_number: str,
    payload: ComplaintAssignRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "LMO"))
):
    complaint = db.query(CitizenComplaint).filter_by(complaint_number=complaint_number).first()
    if not complaint:
        raise HTTPException(404, "Complaint not found")

    target_officer = db.query(User).filter(User.id == payload.officer_id, User.is_active == True).first()
    if not target_officer:
        raise HTTPException(404, "Target officer not found")

    old_officer_id = complaint.assigned_officer_id
    complaint.assigned_officer_id = target_officer.id
    complaint.status = "ASSIGNED"
    complaint.updated_at = datetime.utcnow()

    # Add timeline
    db.add(
        ComplaintTimeline(
            complaint_id=complaint.id,
            action="COMPLAINT_REASSIGNED",
            actor_id=user.id,
            actor_name=user.full_name,
            actor_role=user.role,
            notes=f"Assigned to {target_officer.full_name} ({target_officer.role}). {payload.notes or ''}",
            new_status="ASSIGNED"
        )
    )

    # Notify officer
    db.add(
        Notification(
            user_id=target_officer.id,
            title="Citizen Complaint Reassigned",
            message=f"Complaint {complaint.complaint_number} against '{complaint.shop_name}' has been assigned to you by {user.full_name}.",
            severity="NORMAL"
        )
    )

    audit(
        db,
        user.id,
        "COMPLAINT_REASSIGNED",
        "complaint",
        complaint.complaint_number,
        old_value={"assigned_officer_id": old_officer_id},
        new_value={"assigned_officer_id": target_officer.id, "assigned_officer_name": target_officer.full_name}
    )

    db.commit()
    db.refresh(complaint)
    return complaint


# ==============================================================================
# SHOP SEARCH & ANALYTICS HEATMAP
# ==============================================================================

@router.get("/shops/search", response_model=list[ShopSearchOut])
def search_shops(
    q: str = Query("", min_length=1),
    state: str | None = None,
    district: str | None = None,
    db: Session = Depends(get_db)
):
    query = db.query(ShopRegistry).filter(ShopRegistry.shop_name.ilike(f"%{q}%"))
    if state:
        query = query.filter(func.lower(ShopRegistry.state) == state.lower())
    if district:
        query = query.filter(func.lower(ShopRegistry.district) == district.lower())
    return query.limit(10).all()


@router.get("/analytics/heatmap")
def get_complaint_heatmap_data(
    state: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "LMO", "GATC"))
):
    """Aggregate complaint density, hotspots, and violation categories by district."""
    query = db.query(
        CitizenComplaint.state,
        CitizenComplaint.district,
        func.count(CitizenComplaint.id).label("total_complaints"),
        func.avg(CitizenComplaint.risk_score).label("avg_risk_score"),
        func.avg(CitizenComplaint.latitude).label("avg_lat"),
        func.avg(CitizenComplaint.longitude).label("avg_lng"),
    ).group_by(CitizenComplaint.state, CitizenComplaint.district)

    if state:
        query = query.filter(func.lower(CitizenComplaint.state) == state.lower())

    results = []
    for row in query.all():
        st, dist, count, avg_risk, lat, lng = row
        results.append({
            "state": st,
            "district": dist,
            "count": count,
            "avg_risk_score": round(float(avg_risk or 20), 1),
            "density_level": "HIGH" if count >= 5 else "MEDIUM" if count >= 2 else "LOW",
            "center_lat": lat or 13.0827,
            "center_lng": lng or 80.2707,
        })

    return {
        "districts": results,
        "total_hotspots": len(results),
        "total_active_complaints": sum(r["count"] for r in results),
    }


@router.get("/analytics/risk-matrix")
def get_risk_matrix(
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "LMO", "GATC"))
):
    """Retrieve high-risk establishments and repeat offender establishments."""
    high_risk_shops = (
        db.query(ShopRegistry)
        .filter(ShopRegistry.risk_score >= 40)
        .order_by(ShopRegistry.risk_score.desc())
        .limit(10)
        .all()
    )
    repeat_complaints = (
        db.query(CitizenComplaint)
        .filter(CitizenComplaint.is_repeat_offender == True)
        .order_by(CitizenComplaint.created_at.desc())
        .limit(10)
        .all()
    )

    return {
        "high_risk_shops": [
            {
                "id": s.id,
                "shop_name": s.shop_name,
                "district": s.district,
                "state": s.state,
                "risk_score": s.risk_score,
                "complaint_count": s.complaint_count,
                "violation_count": s.violation_count,
                "is_flagged": s.is_flagged,
            }
            for s in high_risk_shops
        ],
        "repeat_complaints": [
            {
                "complaint_number": c.complaint_number,
                "shop_name": c.shop_name,
                "district": c.district,
                "state": c.state,
                "violation_type": c.violation_type,
                "severity": c.severity,
                "risk_score": c.risk_score,
                "status": c.status,
                "created_at": c.created_at,
            }
            for c in repeat_complaints
        ],
    }
