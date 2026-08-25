from pathlib import Path
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Instrument, VerificationCertificate, VerificationRecord
from app.models.user import User
from app.schemas.platform import InstrumentCreate, InstrumentOut, InstrumentUpdate
from app.services.domain import audit, official_number, risk_for_instrument
from app.utils.dependencies import get_current_user, require_role

router = APIRouter(prefix="/instruments", tags=["Instruments"])

def accessible(query, user: User):
    return query if user.role in {"ADMIN", "LMO", "GATC"} else query.filter(Instrument.owner_id == user.id)

def get_instrument(db: Session, public_id: str, user: User) -> Instrument:
    item = accessible(db.query(Instrument).filter(Instrument.instrument_id == public_id), user).first()
    if not item: raise HTTPException(404, "Instrument not found")
    return item

@router.post("", response_model=InstrumentOut, status_code=status.HTTP_201_CREATED)
def create(payload: InstrumentCreate, db: Session = Depends(get_db), user: User = Depends(require_role("BUSINESS", "ADMIN"))):
    if db.query(Instrument).filter(Instrument.serial_number == payload.serial_number).first(): raise HTTPException(409, "An instrument with this serial number already exists")
    data = payload.model_dump(); data["instrument_id"] = official_number(db, Instrument, "instrument_id", "LM-INST", payload.state); data["owner_id"] = user.id
    item = Instrument(**data); db.add(item); db.flush(); audit(db, user.id, "INSTRUMENT_CREATED", "instrument", item.instrument_id, new_value={"serial_number": item.serial_number}); db.commit(); db.refresh(item); return item

@router.get("", response_model=list[InstrumentOut])
def list_instruments(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return accessible(db.query(Instrument).order_by(Instrument.created_at.desc()), user).all()

@router.get("/{instrument_id}", response_model=InstrumentOut)
def read(instrument_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return get_instrument(db, instrument_id, user)

@router.put("/{instrument_id}", response_model=InstrumentOut)
def update(instrument_id: str, payload: InstrumentUpdate, db: Session = Depends(get_db), user: User = Depends(require_role("BUSINESS", "ADMIN"))):
    item = get_instrument(db, instrument_id, user)
    if user.role != "ADMIN" and item.owner_id != user.id: raise HTTPException(403, "Not permitted")
    for key, value in payload.model_dump().items(): setattr(item, key, value)
    audit(db, user.id, "INSTRUMENT_UPDATED", "instrument", item.instrument_id); db.commit(); db.refresh(item); return item

@router.delete("/{instrument_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(instrument_id: str, db: Session = Depends(get_db), user: User = Depends(require_role("BUSINESS", "ADMIN"))):
    item = get_instrument(db, instrument_id, user)
    if user.role != "ADMIN" and item.owner_id != user.id: raise HTTPException(403, "Not permitted")
    audit(db, user.id, "INSTRUMENT_DELETED", "instrument", item.instrument_id); db.delete(item); db.commit()

@router.get("/{instrument_id}/passport")
def passport(instrument_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    item = get_instrument(db, instrument_id, user)
    cert = db.query(VerificationCertificate).filter(VerificationCertificate.instrument_id == item.id).order_by(VerificationCertificate.created_at.desc()).first()
    records = db.query(VerificationRecord).filter(VerificationRecord.instrument_id == item.id).order_by(VerificationRecord.verified_at.desc()).all()
    score, level = risk_for_instrument(db, item)
    return {"instrument": InstrumentOut.model_validate(item), "current_certificate": None if not cert else {"number": cert.certificate_number, "valid_until": cert.valid_until, "status": cert.status}, "verification_history": [{"id": r.id, "result": r.result, "verified_at": r.verified_at, "remarks": r.remarks} for r in records], "documents": [{"filename": d.filename, "path": d.storage_path} for d in item.documents], "photos": [{"path": p.storage_path, "caption": p.caption} for p in item.photos], "risk_score": score, "risk_level": level}

@router.post("/{instrument_id}/documents", status_code=status.HTTP_201_CREATED)
async def upload_document(instrument_id: str, file: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(require_role("BUSINESS", "ADMIN"))):
    """Development storage adapter. Replace its path with a Supabase/S3 adapter in production."""
    item = get_instrument(db, instrument_id, user)
    if user.role != "ADMIN" and item.owner_id != user.id: raise HTTPException(403, "Not permitted")
    allowed = {"application/pdf", "image/jpeg", "image/png"}
    if file.content_type not in allowed: raise HTTPException(415, "Only PDF, JPEG, and PNG files are supported")
    content = await file.read()
    if len(content) > 10 * 1024 * 1024: raise HTTPException(413, "File exceeds 10 MB limit")
    directory = Path(__file__).resolve().parents[3] / "storage" / "instrument-documents"
    directory.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "upload").suffix.lower()
    path = directory / f"{uuid4().hex}{suffix}"
    path.write_bytes(content)
    from app.models import InstrumentDocument
    document = InstrumentDocument(instrument_id=item.id, storage_path=str(path.relative_to(directory.parents[1])), filename=file.filename or path.name, content_type=file.content_type, uploaded_by_id=user.id)
    db.add(document); audit(db, user.id, "INSTRUMENT_DOCUMENT_UPLOADED", "instrument", item.instrument_id); db.commit()
    return {"id": document.id, "path": document.storage_path}
