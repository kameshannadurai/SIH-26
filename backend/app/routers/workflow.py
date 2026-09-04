from pathlib import Path
from uuid import uuid4
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, Form, HTTPException, Request, UploadFile, File, status, Query
from fastapi.responses import HTMLResponse, FileResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import (
    CertificateVerification,
    EnforcementRecord,
    Instrument,
    LocationRecord,
    Notification,
    VerificationApplication,
    VerificationAssignment,
    VerificationCertificate,
    VerificationMeasurement,
    VerificationObservation,
    VerificationRecord,
)
from app.models.user import User
from app.schemas.platform import (
    AssignmentCreate,
    AssignmentUpdate,
    CertificateOut,
    CertificateRevokeRequest,
    EnforcementCreate,
    PublicCertificateOut,
    VerificationCreate,
    VerificationUpdate,
)
from app.services.domain import (
    audit,
    certificate_digest,
    issue_certificate,
    revoke_certificate,
    validate_gps_geofence,
)
from app.utils.dependencies import get_current_user, require_role

storage_router = APIRouter(prefix="/storage", tags=["Secure Storage"])

assignments = APIRouter(prefix="/assignments", tags=["Assignments"])
verifications = APIRouter(prefix="/verifications", tags=["Verifications"])
certificates = APIRouter(prefix="/certificates", tags=["Certificates"])
notifications = APIRouter(prefix="/notifications", tags=["Notifications"])
enforcement = APIRouter(prefix="/enforcement", tags=["Enforcement"])
public = APIRouter(prefix="/public", tags=["Public Verification"])
ai = APIRouter(prefix="/ai", tags=["AI Assistance"])


# ==========================================
# ASSIGNMENTS
# ==========================================

@assignments.post("", status_code=status.HTTP_201_CREATED)
def create_assignment(payload: AssignmentCreate, db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN"))):
    application = db.query(VerificationApplication).filter_by(application_number=payload.application_number).first()
    officer = db.query(User).filter_by(id=payload.assigned_officer_id).first()
    if not application:
        raise HTTPException(404, "Application not found")
    if application.status not in {"SUBMITTED", "UNDER_REVIEW", "SCHEDULED"}:
        raise HTTPException(409, "Application is not ready for assignment")
    if not officer or officer.role not in {"LMO", "GATC"}:
        raise HTTPException(422, "Assigned officer must be an active LMO or GATC user")
    
    window_start = payload.scheduled_at - timedelta(hours=1)
    window_end = payload.scheduled_at + timedelta(hours=1)
    conflict = db.query(VerificationAssignment).filter(
        VerificationAssignment.assigned_officer_id == officer.id,
        VerificationAssignment.status.in_(["ASSIGNED", "ACCEPTED"]),
        VerificationAssignment.scheduled_at.between(window_start, window_end)
    ).first()
    if conflict:
        raise HTTPException(409, "Officer has an overlapping assignment")
    
    assignment = VerificationAssignment(
        application_id=application.id,
        assigned_officer_id=officer.id,
        centre_id=payload.centre_id,
        scheduled_at=payload.scheduled_at,
        location=payload.location,
        priority=payload.priority.upper(),
        created_by_id=user.id
    )
    application.status = "ASSIGNED"
    db.add(assignment)
    db.add(Notification(
        user_id=officer.id,
        title="New verification assignment",
        message=f"You have been assigned {application.application_number}",
        severity=assignment.priority
    ))
    db.flush()
    audit(db, user.id, "ASSIGNMENT_CREATED", "assignment", str(assignment.id))
    db.commit()
    return {"id": assignment.id, "status": assignment.status}


@assignments.get("")
def list_assignments(
    q: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    query = db.query(VerificationAssignment).join(VerificationApplication).order_by(VerificationAssignment.scheduled_at.desc())
    if user.role in {"LMO", "GATC"}:
        query = query.filter(VerificationAssignment.assigned_officer_id == user.id)
    elif user.role == "BUSINESS":
        query = query.filter(VerificationApplication.applicant_id == user.id)
        
    if status:
        query = query.filter(VerificationAssignment.status == status.upper().strip())
    if q:
        query = query.filter(
            or_(
                VerificationApplication.application_number.ilike(f"%{q}%"),
                VerificationAssignment.location.ilike(f"%{q}%")
            )
        )
        
    results = []
    for a in query.all():
        app = a.application
        inst = app.instrument if app else None
        results.append({
            "id": a.id,
            "application_id": a.application_id,
            "application_number": app.application_number if app else None,
            "officer_id": a.assigned_officer_id,
            "centre_id": a.centre_id,
            "scheduled_at": a.scheduled_at,
            "location": a.location,
            "status": a.status,
            "priority": a.priority,
            "instrument": {
                "instrument_id": inst.instrument_id,
                "instrument_type": inst.instrument_type,
                "category": inst.category,
                "manufacturer": inst.manufacturer,
                "model": inst.model,
                "serial_number": inst.serial_number,
                "state": inst.state,
                "district": inst.district,
            } if inst else None
        })
    return results


@assignments.put("/{assignment_id}")
def update_assignment(assignment_id: int, payload: AssignmentUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    a = db.get(VerificationAssignment, assignment_id)
    if not a:
        raise HTTPException(404, "Assignment not found")
    if user.role not in {"ADMIN"} and a.assigned_officer_id != user.id:
        raise HTTPException(403, "Not permitted")
    if user.role != "ADMIN" and payload.status not in {"ACCEPTED", "REJECTED"}:
        raise HTTPException(403, "Officers may only accept or reject assignments")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(a, k, v.upper() if k in {"status", "priority"} else v)
    audit(db, user.id, "ASSIGNMENT_UPDATED", "assignment", str(a.id))
    db.commit()
    return {"id": a.id, "status": a.status}


@assignments.post("/{assignment_id}/complete")
def complete_assignment(assignment_id: int, db: Session = Depends(get_db), user: User = Depends(require_role("LMO", "GATC", "ADMIN"))):
    a = db.get(VerificationAssignment, assignment_id)
    if not a or (user.role != "ADMIN" and a.assigned_officer_id != user.id):
        raise HTTPException(404, "Assignment not found")
    a.status = "COMPLETED"
    audit(db, user.id, "ASSIGNMENT_COMPLETED", "assignment", str(a.id))
    db.commit()
    return {"success": True}


# ==========================================
# VERIFICATIONS
# ==========================================

def get_record(db: Session, record_id: int, user: User) -> VerificationRecord:
    item = db.get(VerificationRecord, record_id)
    if not item or (user.role not in {"ADMIN"} and item.officer_id != user.id):
        raise HTTPException(404, "Verification record not found")
    return item


@verifications.post("", status_code=status.HTTP_201_CREATED)
def start_verification(payload: VerificationCreate, db: Session = Depends(get_db), user: User = Depends(require_role("LMO", "GATC", "ADMIN"))):
    app = db.query(VerificationApplication).filter_by(application_number=payload.application_number).first()
    if not app:
        raise HTTPException(404, "Application not found")
    
    assigned = db.query(VerificationAssignment).filter_by(application_id=app.id, assigned_officer_id=user.id).first()
    if user.role != "ADMIN" and not assigned:
        raise HTTPException(403, "No assignment for this application exists for your account")
        
    existing_rec = db.query(VerificationRecord).filter_by(application_id=app.id).first()
    if existing_rec:
        return {"id": existing_rec.id, "status": existing_rec.status, "message": "Resumed existing verification record"}

    record = VerificationRecord(
        application_id=app.id,
        instrument_id=app.instrument_id,
        officer_id=user.id,
        latitude=payload.latitude,
        longitude=payload.longitude,
        remarks=payload.remarks,
        standards_used=payload.standards_used,
        defects_found=payload.defects_found,
    )
    db.add(record)
    db.flush()
    
    for text in payload.observations:
        db.add(VerificationObservation(verification_id=record.id, observation=text))
    for m in payload.measurements:
        db.add(VerificationMeasurement(verification_id=record.id, **m.model_dump()))
    if payload.latitude is not None and payload.longitude is not None:
        db.add(LocationRecord(instrument_id=app.instrument_id, verification_id=record.id, latitude=payload.latitude, longitude=payload.longitude))
        
    app.status = "IN_VERIFICATION"
    audit(db, user.id, "VERIFICATION_STARTED", "verification", str(record.id))
    db.commit()
    return {"id": record.id, "status": record.status}


@verifications.get("/{record_id}")
def get_verification(record_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    r = get_record(db, record_id, user)
    inst = db.get(Instrument, r.instrument_id)
    app = db.get(VerificationApplication, r.application_id)
    owner = db.get(User, inst.owner_id) if inst else None

    gps_val = validate_gps_geofence(
        reg_lat=owner.latitude if owner else None,
        reg_lng=owner.longitude if owner else None,
        act_lat=r.latitude,
        act_lng=r.longitude,
    )

    return {
        "id": r.id,
        "application_number": app.application_number if app else None,
        "instrument_id": inst.instrument_id if inst else None,
        "status": r.status,
        "result": r.result,
        "remarks": r.remarks,
        "standards_used": r.standards_used,
        "defects_found": r.defects_found,
        "evidence_paths": r.evidence_paths or [],
        "evidence_metadata": r.evidence_metadata or [],
        "latitude": r.latitude,
        "longitude": r.longitude,
        "gps_validation": gps_val,
        "measurements": [
            {
                "parameter": m.parameter,
                "observed_value": m.observed_value,
                "expected_value": m.expected_value,
                "unit": m.unit,
                "within_tolerance": m.within_tolerance,
            }
            for m in r.measurements
        ],
        "observations": [o.observation for o in r.observations]
    }



@verifications.put("/{record_id}")
def update_verification(record_id: int, payload: VerificationUpdate, db: Session = Depends(get_db), user: User = Depends(require_role("LMO", "GATC", "ADMIN"))):
    r = get_record(db, record_id, user)
    if r.status != "IN_PROGRESS":
        raise HTTPException(409, "Completed verification is immutable")
    for k in ("latitude", "longitude", "remarks", "standards_used", "defects_found"):
        v = getattr(payload, k)
        if v is not None:
            setattr(r, k, v)
    if payload.observations is not None:
        r.observations.clear()
        for x in payload.observations:
            r.observations.append(VerificationObservation(observation=x))
    if payload.measurements is not None:
        r.measurements.clear()
        for x in payload.measurements:
            r.measurements.append(VerificationMeasurement(**x.model_dump()))
    audit(db, user.id, "VERIFICATION_UPDATED", "verification", str(r.id))
    db.commit()
    return {"id": r.id, "status": r.status}


@verifications.post("/{record_id}/evidence", status_code=status.HTTP_201_CREATED)
async def upload_verification_evidence(
    record_id: int,
    file: UploadFile = File(...),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    captured_at: str | None = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(require_role("LMO", "GATC", "ADMIN"))
):
    r = get_record(db, record_id, user)
    allowed = {"image/jpeg", "image/png", "application/pdf"}
    if file.content_type not in allowed:
        raise HTTPException(415, "Only PDF, JPEG, and PNG files are supported")
    
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(413, "File exceeds 10 MB limit")
        
    raw_name = Path(file.filename or "evidence").name
    safe_suffix = Path(raw_name).suffix.lower()
    if safe_suffix not in {".pdf", ".jpg", ".jpeg", ".png"}:
        raise HTTPException(400, "Invalid file extension")

    directory = Path(__file__).resolve().parents[3] / "storage" / "verification-evidence"
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"{uuid4().hex}{safe_suffix}"
    path.write_bytes(content)
    
    rel_path = f"storage/verification-evidence/{path.name}"
    
    # Update paths list
    paths = list(r.evidence_paths or [])
    paths.append(rel_path)
    r.evidence_paths = paths
    
    # Update metadata list with GPS and timestamp
    meta_list = list(r.evidence_metadata or [])
    meta_list.append({
        "path": rel_path,
        "filename": raw_name,
        "latitude": latitude,
        "longitude": longitude,
        "captured_at": captured_at or datetime.utcnow().isoformat()
    })
    r.evidence_metadata = meta_list
    
    db.commit()
    return {"id": r.id, "path": rel_path, "filename": raw_name}


@verifications.post("/{record_id}/approve")
def approve(record_id: int, db: Session = Depends(get_db), user: User = Depends(require_role("LMO", "GATC", "ADMIN"))):
    r = get_record(db, record_id, user)
    if r.status != "IN_PROGRESS":
        raise HTTPException(409, "Verification already finalised")
        
    app = db.get(VerificationApplication, r.application_id)
    instrument = db.get(Instrument, r.instrument_id)
    
    r.result = "PASS"
    r.status = "APPROVED"
    app.status = "CERTIFICATE_ISSUED"
    instrument.status = "VERIFIED"
    instrument.last_verification_date = date.today()
    instrument.next_verification_due_date = date.today() + timedelta(days=365)
    
    db.query(VerificationAssignment).filter_by(application_id=app.id).update({"status": "COMPLETED"})
    cert = issue_certificate(db, r, instrument, app, issuing_officer_id=user.id)
    
    db.add(Notification(
        user_id=app.applicant_id,
        title="Verification Certificate Issued",
        message=f"Certificate {cert.certificate_number} for {instrument.instrument_id} is now available.",
        severity="NORMAL"
    ))
    
    audit(db, user.id, "VERIFICATION_APPROVED", "verification", str(r.id))
    audit(db, user.id, "CERTIFICATE_ISSUED", "certificate", cert.certificate_number)
    db.commit()
    
    return {
        "verification_id": r.id,
        "certificate_number": cert.certificate_number,
        "certificate_hash": cert.certificate_hash,
        "qr_token": cert.qr_token
    }


@verifications.post("/{record_id}/reject")
def reject(record_id: int, db: Session = Depends(get_db), user: User = Depends(require_role("LMO", "GATC", "ADMIN"))):
    r = get_record(db, record_id, user)
    if r.status != "IN_PROGRESS":
        raise HTTPException(409, "Verification already finalised")
        
    r.result = "FAIL"
    r.status = "REJECTED"
    app = db.get(VerificationApplication, r.application_id)
    app.status = "REJECTED"
    inst = db.get(Instrument, r.instrument_id)
    inst.status = "REJECTED"
    
    db.add(Notification(
        user_id=app.applicant_id,
        title="Verification Rejected",
        message=f"Verification for application {app.application_number} failed requirements. Please review remarks and rectifications.",
        severity="HIGH"
    ))
    
    audit(db, user.id, "VERIFICATION_REJECTED", "verification", str(r.id))
    db.commit()
    return {"verification_id": r.id, "result": "FAIL"}


# ==========================================
# CERTIFICATES & REVOCATION
# ==========================================

@certificates.get("", response_model=list[CertificateOut])
def list_certificates(
    q: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    query = db.query(VerificationCertificate).order_by(VerificationCertificate.created_at.desc())
    if user.role == "BUSINESS":
        query = query.join(Instrument).filter(Instrument.owner_id == user.id)
        
    if status:
        query = query.filter(VerificationCertificate.status == status.upper().strip())
    if q:
        query = query.filter(
            or_(
                VerificationCertificate.certificate_number.ilike(f"%{q}%"),
                VerificationCertificate.qr_token.ilike(f"%{q}%")
            )
        )
    return query.all()


@certificates.post("/{certificate_number}/revoke")
def revoke(
    certificate_number: str,
    payload: CertificateRevokeRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("ADMIN", "LMO"))
):
    cert = db.query(VerificationCertificate).filter_by(certificate_number=certificate_number).first()
    if not cert:
        raise HTTPException(404, "Certificate not found")
    if cert.status == "REVOKED":
        raise HTTPException(409, "Certificate is already revoked")
    
    updated_cert = revoke_certificate(db, cert, payload.reason, user)
    return {
        "certificate_number": updated_cert.certificate_number,
        "status": updated_cert.status,
        "revocation_reason": updated_cert.revocation_reason,
        "revoked_at": updated_cert.revoked_at
    }


# ==========================================
# PUBLIC VERIFICATION (QR CODE TARGET)
# ==========================================

def resolve_public_certificate(db: Session, identifier: str, request: Request | None = None) -> PublicCertificateOut:
    # Look up by qr_token first, then by certificate_number
    c = db.query(VerificationCertificate).filter(
        or_(
            VerificationCertificate.qr_token == identifier,
            VerificationCertificate.certificate_number == identifier
        )
    ).first()
    
    if not c:
        raise HTTPException(404, "Certificate not found. Ensure the QR code or certificate number is valid.")
        
    instrument = db.get(Instrument, c.instrument_id)
    app = db.get(VerificationApplication, c.application_id)
    
    digest_ok = certificate_digest(c, instrument, app) == c.certificate_hash
    is_valid = c.status == "VALID" and c.valid_until >= date.today() and digest_ok
    current_status = c.status if c.status in {"REVOKED", "SUPERSEDED"} else ("VALID" if is_valid else "EXPIRED")
    
    db.add(CertificateVerification(
        certificate_id=c.id,
        valid=is_valid,
        requester_ip=request.client.host if request and request.client else None
    ))
    db.commit()
    
    return PublicCertificateOut(
        valid=is_valid,
        certificate_number=c.certificate_number,
        instrument_id=instrument.instrument_id,
        instrument_type=instrument.instrument_type,
        category=instrument.category,
        manufacturer=instrument.manufacturer,
        model=instrument.model,
        serial_number=instrument.serial_number,
        verification_date=c.valid_from,
        valid_until=c.valid_until,
        status=current_status,
        certificate_hash_verified=digest_ok,
        qr_token=c.qr_token,
        revocation_reason=c.revocation_reason if c.status == "REVOKED" else None
    )


@public.get("/verify/{identifier}", response_model=PublicCertificateOut)
def verify_public(identifier: str, request: Request, db: Session = Depends(get_db)):
    """Public, non-authenticated verification endpoint for QR code scans and token lookups."""
    return resolve_public_certificate(db, identifier, request)


@public.get("/verify/{identifier}/page", response_class=HTMLResponse, include_in_schema=False)
def public_verification_page(identifier: str):
    """Clean public verification webpage for mobile QR scanners."""
    return f"""<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Legal Metrology Certificate Verification</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #071224; color: #f0f6fc; margin: 0; padding: 20px; display: flex; justify-content: center; }}
        .card {{ background: #0d1b2a; border: 1px solid #1e3a5f; border-radius: 12px; max-width: 550px; width: 100%; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
        .badge {{ display: inline-block; padding: 6px 12px; border-radius: 6px; font-weight: 700; font-size: 0.85rem; margin-bottom: 12px; }}
        .badge.valid {{ background: #166534; color: #86efac; }}
        .badge.revoked {{ background: #991b1b; color: #fca5a5; }}
        .badge.expired {{ background: #854d0e; color: #fde047; }}
        h1 {{ font-size: 1.4rem; color: #60a5fa; margin-top: 0; }}
        dl {{ display: grid; grid-template-columns: 140px 1fr; gap: 8px; font-size: 0.95rem; }}
        dt {{ color: #94a3b8; font-weight: 600; }}
        dd {{ margin: 0; color: #f8fafc; font-weight: 500; }}
        .seal {{ border: 2px solid #60a5fa; color: #60a5fa; border-radius: 50%; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; font-weight: 900; margin-bottom: 16px; }}
    </style>
</head>
<body>
    <div class="card" id="app">
        <div class="seal">LM</div>
        <h1>Legal Metrology Verification</h1>
        <p id="loading">Verifying certificate with national registry...</p>
        <div id="content" style="display:none;"></div>
    </div>
    <script>
        fetch('/public/verify/{identifier}')
            .then(r => {{
                if(!r.ok) throw new Error("Certificate not found or invalid QR token.");
                return r.json();
            }})
            .then(d => {{
                document.getElementById('loading').style.display = 'none';
                const el = document.getElementById('content');
                el.style.display = 'block';
                const badgeClass = d.status === 'VALID' ? 'valid' : (d.status === 'REVOKED' ? 'revoked' : 'expired');
                el.innerHTML = `
                    <span class="badge ${{badgeClass}}">${{d.status}} CERTIFICATE</span>
                    <dl>
                        <dt>Certificate No:</dt><dd>${{d.certificate_number}}</dd>
                        <dt>Instrument Type:</dt><dd>${{d.instrument_type}}</dd>
                        <dt>Manufacturer:</dt><dd>${{d.manufacturer}} ${{d.model || ''}}</dd>
                        <dt>Serial No:</dt><dd>${{d.serial_number || '—'}}</dd>
                        <dt>Valid From:</dt><dd>${{d.verification_date}}</dd>
                        <dt>Valid Until:</dt><dd>${{d.valid_until}}</dd>
                        <dt>Hash Check:</dt><dd>${{d.certificate_hash_verified ? '✓ SHA-256 VERIFIED' : '✖ HASH MISMATCH'}}</dd>
                        ${{d.revocation_reason ? `<dt style="color:#f87171">Revocation:</dt><dd style="color:#f87171">${{d.revocation_reason}}</dd>` : ''}}
                    </dl>
                `;
            }})
            .catch(err => {{
                document.getElementById('loading').innerHTML = '<span style="color:#f87171; font-weight:bold;">' + err.message + '</span>';
            }});
    </script>
</body>
</html>"""


# ==========================================
# NOTIFICATIONS & ENFORCEMENT
# ==========================================

@notifications.get("")
def list_notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "severity": n.severity,
            "is_read": n.is_read,
            "created_at": n.created_at
        }
        for n in db.query(Notification).filter_by(user_id=user.id).order_by(Notification.created_at.desc()).all()
    ]


@notifications.post("/{notification_id}/read")
def read_notification(notification_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    n = db.query(Notification).filter_by(id=notification_id, user_id=user.id).first()
    if not n:
        raise HTTPException(404, "Notification not found")
    n.is_read = True
    db.commit()
    return {"success": True}


@enforcement.post("", status_code=status.HTTP_201_CREATED)
def create_enforcement(payload: EnforcementCreate, db: Session = Depends(get_db), user: User = Depends(require_role("LMO", "GATC", "ADMIN"))):
    instrument = db.query(Instrument).filter_by(instrument_id=payload.instrument_id).first()
    if not instrument:
        raise HTTPException(404, "Instrument not found")
    record = EnforcementRecord(instrument_id=instrument.id, officer_id=user.id, **payload.model_dump(exclude={"instrument_id"}))
    db.add(record)
    db.flush()
    audit(db, user.id, "ENFORCEMENT_RECORDED", "enforcement", str(record.id))
    db.commit()
    return {"id": record.id}


@enforcement.get("")
def list_enforcement(db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN", "LMO", "GATC"))):
    return [
        {
            "id": x.id,
            "instrument_id": x.instrument_id,
            "violation_type": x.violation_type,
            "severity": x.severity,
            "notes": x.notes,
            "action_taken": x.action_taken,
            "recorded_at": x.recorded_at
        }
        for x in db.query(EnforcementRecord).order_by(EnforcementRecord.recorded_at.desc()).all()
    ]


# ==========================================
# AI ASSISTANCE
# ==========================================

@ai.post("/instrument-extract")
async def assist_instrument_extract(image: UploadFile = File(...), user: User = Depends(require_role("LMO", "GATC", "ADMIN"))):
    if image.content_type not in {"image/jpeg", "image/png"}:
        raise HTTPException(415, "JPEG or PNG image required")
    data = await image.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(413, "Image exceeds 10 MB limit")
    from app.services.ai_assist import InstrumentAiAssistant
    return InstrumentAiAssistant().extract(data).__dict__ | {"requires_officer_confirmation": True}


# ==========================================
# SECURE FILE STORAGE & DELIVERY
# ==========================================

@storage_router.get("/{file_category}/{filename}")
def serve_file(
    file_category: str,
    filename: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    import sqlalchemy as sa
    if file_category not in {"instrument-documents", "application-documents", "verification-evidence"}:
        raise HTTPException(400, "Invalid file category")
    if ".." in filename or filename.startswith("/") or filename.startswith("\\"):
        raise HTTPException(400, "Invalid filename")
    base_dir = Path(__file__).resolve().parents[3] / "storage" / file_category
    filepath = base_dir / filename
    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(404, "File not found")
        
    if user.role == "ADMIN":
        return FileResponse(filepath)
        
    db_rel_path = f"storage/{file_category}/{filename}"
    if file_category == "instrument-documents":
        from app.models import InstrumentDocument
        doc = db.query(InstrumentDocument).filter_by(storage_path=db_rel_path).first()
        if doc:
            inst = db.get(Instrument, doc.instrument_id)
            if inst and (user.role in {"LMO", "GATC"} or inst.owner_id == user.id):
                return FileResponse(filepath)
    elif file_category == "application-documents":
        app = db.query(VerificationApplication).filter(VerificationApplication.supporting_documents.cast(sa.String).contains(db_rel_path)).first()
        if app:
            if user.role in {"LMO", "GATC"} or app.applicant_id == user.id:
                return FileResponse(filepath)
    elif file_category == "verification-evidence":
        rec = db.query(VerificationRecord).filter(
            or_(
                VerificationRecord.evidence_paths.cast(sa.String).contains(db_rel_path),
                VerificationRecord.evidence_metadata.cast(sa.String).contains(db_rel_path)
            )
        ).first()
        if rec:
            if user.role in {"LMO", "GATC"} or db.query(VerificationApplication).filter_by(id=rec.application_id, applicant_id=user.id).first():
                return FileResponse(filepath)
                
    raise HTTPException(403, "Access to this file is restricted")
