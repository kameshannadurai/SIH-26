from datetime import date
from pathlib import Path
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Instrument, VerificationCertificate, VerificationRecord
from app.models.user import User
from app.routers.gatc_rules import GATC_CATEGORIES
from app.schemas.platform import DueTrackingItem, InstrumentCreate, InstrumentOut, InstrumentUpdate
from app.services.domain import audit, official_number, risk_for_instrument
from app.utils.dependencies import get_current_user, require_role

router = APIRouter(prefix="/instruments", tags=["Instruments"])

def accessible(query, user: User):
    return query if user.role in {"ADMIN", "LMO", "GATC"} else query.filter(Instrument.owner_id == user.id)

def get_instrument(db: Session, public_id: str, user: User) -> Instrument:
    item = accessible(db.query(Instrument).filter(Instrument.instrument_id == public_id), user).first()
    if not item:
        raise HTTPException(404, "Instrument not found")
    return item

@router.get("/due-tracking", response_model=list[DueTrackingItem])
def due_tracking(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Categorized due-date tracking across all accessible instruments."""
    query = accessible(db.query(Instrument), user)
    instruments = query.all()
    today = date.today()
    result = []
    
    for inst in instruments:
        due = inst.next_verification_due_date
        days = (due - today).days if due else None
        
        if due is None:
            urgency = "NO_RECORD"
        elif days < 0:
            urgency = "OVERDUE"
        elif days <= 15:
            urgency = "EXPIRING_15_DAYS"
        elif days <= 30:
            urgency = "EXPIRING_30_DAYS"
        else:
            urgency = "COMPLIANT"
            
        result.append(
            DueTrackingItem(
                instrument_id=inst.instrument_id,
                serial_number=inst.serial_number,
                instrument_type=inst.instrument_type,
                category=inst.category,
                manufacturer=inst.manufacturer,
                owner_name=inst.owner_name,
                state=inst.state,
                district=inst.district,
                next_verification_due_date=due,
                days_remaining=days,
                urgency=urgency,
            )
        )
    return sorted(result, key=lambda x: (x.days_remaining is None, x.days_remaining or 9999))

@router.get("/search", response_model=list[InstrumentOut])
def search_instruments(
    q: str | None = None,
    instrument_type: str | None = None,
    category: str | None = None,
    status: str | None = None,
    state: str | None = None,
    district: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    query = accessible(db.query(Instrument), user)
    
    if category:
        query = query.filter(Instrument.category == category.lower().strip())
    if instrument_type:
        query = query.filter(Instrument.instrument_type.ilike(f"%{instrument_type}%"))
    if status:
        query = query.filter(Instrument.status == status.upper().strip())
    if state:
        query = query.filter(Instrument.state.ilike(f"%{state}%"))
    if district:
        query = query.filter(Instrument.district.ilike(f"%{district}%"))
        
    if q:
        query = query.filter(
            or_(
                Instrument.instrument_id.ilike(f"%{q}%"),
                Instrument.serial_number.ilike(f"%{q}%"),
                Instrument.owner_name.ilike(f"%{q}%"),
                Instrument.model.ilike(f"%{q}%"),
                Instrument.manufacturer.ilike(f"%{q}%"),
            )
        )
    return query.order_by(Instrument.created_at.desc()).all()

@router.post("", response_model=InstrumentOut, status_code=status.HTTP_201_CREATED)
def create(
    payload: InstrumentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("BUSINESS", "ADMIN"))
):
    # Validate category belongs to the 18 sanctioned categories from 2025 GATC Amendment
    allowed_categories = {c["id"] for c in GATC_CATEGORIES}
    cat_id = payload.category.lower().strip()
    if cat_id not in allowed_categories:
        raise HTTPException(
            400,
            f"Invalid verifiable category '{payload.category}'. Must be one of the 18 categories under 2025 GATC Amendment Rules."
        )

    if db.query(Instrument).filter(Instrument.serial_number == payload.serial_number.strip()).first():
        raise HTTPException(409, "An instrument with this serial number already exists")

    data = payload.model_dump()
    data["category"] = cat_id
    data["instrument_id"] = official_number(db, Instrument, "instrument_id", "LM-INST", payload.state)
    data["owner_id"] = user.id

    item = Instrument(**data)
    db.add(item)
    db.flush()
    audit(db, user.id, "INSTRUMENT_CREATED", "instrument", item.instrument_id, new_value={"serial_number": item.serial_number, "category": cat_id})
    db.commit()
    db.refresh(item)
    return item

@router.get("", response_model=list[InstrumentOut])
def list_instruments(
    q: str | None = None,
    category: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    query = accessible(db.query(Instrument), user)
    if category:
        query = query.filter(Instrument.category == category.lower().strip())
    if status:
        query = query.filter(Instrument.status == status.upper().strip())
    if q:
        query = query.filter(
            or_(
                Instrument.instrument_id.ilike(f"%{q}%"),
                Instrument.serial_number.ilike(f"%{q}%"),
                Instrument.owner_name.ilike(f"%{q}%"),
            )
        )
    return query.order_by(Instrument.created_at.desc()).all()

@router.get("/{instrument_id}", response_model=InstrumentOut)
def read(instrument_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return get_instrument(db, instrument_id, user)

@router.put("/{instrument_id}", response_model=InstrumentOut)
def update(
    instrument_id: str,
    payload: InstrumentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("BUSINESS", "ADMIN"))
):
    item = get_instrument(db, instrument_id, user)
    if user.role != "ADMIN" and item.owner_id != user.id:
        raise HTTPException(403, "Not permitted")
    
    allowed_categories = {c["id"] for c in GATC_CATEGORIES}
    cat_id = payload.category.lower().strip()
    if cat_id not in allowed_categories:
        raise HTTPException(400, f"Invalid category '{payload.category}' under 2025 GATC Amendment Rules")

    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    item.category = cat_id
    audit(db, user.id, "INSTRUMENT_UPDATED", "instrument", item.instrument_id)
    db.commit()
    db.refresh(item)
    return item

@router.delete("/{instrument_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(instrument_id: str, db: Session = Depends(get_db), user: User = Depends(require_role("BUSINESS", "ADMIN"))):
    item = get_instrument(db, instrument_id, user)
    if user.role != "ADMIN" and item.owner_id != user.id:
        raise HTTPException(403, "Not permitted")
    audit(db, user.id, "INSTRUMENT_DELETED", "instrument", item.instrument_id)
    db.delete(item)
    db.commit()

@router.get("/{instrument_id}/passport")
def passport(instrument_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    item = get_instrument(db, instrument_id, user)
    certs = (
        db.query(VerificationCertificate)
        .filter(VerificationCertificate.instrument_id == item.id)
        .order_by(VerificationCertificate.created_at.desc())
        .all()
    )
    active_cert = next((c for c in certs if c.status == "VALID"), None)
    records = (
        db.query(VerificationRecord)
        .filter(VerificationRecord.instrument_id == item.id)
        .order_by(VerificationRecord.verified_at.desc())
        .all()
    )
    score, level = risk_for_instrument(db, item)
    
    return {
        "instrument": InstrumentOut.model_validate(item),
        "current_certificate": None if not active_cert else {
            "number": active_cert.certificate_number,
            "valid_from": active_cert.valid_from,
            "valid_until": active_cert.valid_until,
            "status": active_cert.status,
            "qr_token": active_cert.qr_token,
            "certificate_hash": active_cert.certificate_hash,
            "issuing_officer_id": active_cert.issuing_officer_id,
        },
        "all_certificates": [
            {
                "number": c.certificate_number,
                "valid_from": c.valid_from,
                "valid_until": c.valid_until,
                "status": c.status,
                "created_at": c.created_at,
                "qr_token": c.qr_token,
                "revocation_reason": c.revocation_reason,
            }
            for c in certs
        ],
        "verification_history": [
            {
                "id": r.id,
                "result": r.result,
                "status": r.status,
                "verified_at": r.verified_at,
                "remarks": r.remarks,
                "standards_used": r.standards_used,
                "defects_found": r.defects_found,
                "evidence_paths": r.evidence_paths or [],
                "evidence_metadata": r.evidence_metadata or [],
                "latitude": r.latitude,
                "longitude": r.longitude,
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
                "observations": [o.observation for o in r.observations],
            }
            for r in records
        ],
        "documents": [{"filename": d.filename, "path": d.storage_path} for d in item.documents],
        "photos": [{"path": p.storage_path, "caption": p.caption} for p in item.photos],
        "risk_score": score,
        "risk_level": level,
    }

@router.post("/{instrument_id}/documents", status_code=status.HTTP_201_CREATED)
async def upload_document(
    instrument_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_role("BUSINESS", "ADMIN"))
):
    item = get_instrument(db, instrument_id, user)
    if user.role != "ADMIN" and item.owner_id != user.id:
        raise HTTPException(403, "Not permitted")
    
    allowed = {"application/pdf", "image/jpeg", "image/png"}
    if file.content_type not in allowed:
        raise HTTPException(415, "Only PDF, JPEG, and PNG files are supported")
    
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(413, "File exceeds 10 MB limit")
        
    raw_name = Path(file.filename or "upload").name
    safe_suffix = Path(raw_name).suffix.lower()
    if safe_suffix not in {".pdf", ".jpg", ".jpeg", ".png"}:
        raise HTTPException(400, "Invalid file extension")

    directory = Path(__file__).resolve().parents[3] / "storage" / "instrument-documents"
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"{uuid4().hex}{safe_suffix}"
    path.write_bytes(content)
    
    from app.models import InstrumentDocument
    document = InstrumentDocument(
        instrument_id=item.id,
        storage_path=str(path.relative_to(directory.parents[1])).replace("\\", "/"),
        filename=raw_name,
        content_type=file.content_type,
        uploaded_by_id=user.id
    )
    db.add(document)
    audit(db, user.id, "INSTRUMENT_DOCUMENT_UPLOADED", "instrument", item.instrument_id)
    db.commit()
    return {"id": document.id, "path": document.storage_path}
