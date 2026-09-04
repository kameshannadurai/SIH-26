from pathlib import Path
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Instrument, VerificationApplication, VerificationAssignment
from app.models.user import User
from app.schemas.platform import ApplicationCreate, ApplicationOut, ApplicationUpdate
from app.services.domain import assign_to_regional_lmo, audit, official_number, route_verification_application
from app.utils.dependencies import get_current_user, require_role

router = APIRouter(prefix="/applications", tags=["Applications"])
TERMINAL = {"CANCELLED", "REJECTED", "CERTIFICATE_ISSUED"}

def fetch(db: Session, number: str, user: User) -> VerificationApplication:
    item = db.query(VerificationApplication).filter(VerificationApplication.application_number == number).first()
    if not item or (user.role == "BUSINESS" and item.applicant_id != user.id):
        raise HTTPException(404, "Application not found")
    return item

@router.post("", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
def create(
    payload: ApplicationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("BUSINESS", "ADMIN"))
):
    instrument = db.query(Instrument).filter(Instrument.instrument_id == payload.instrument_id).first()
    if not instrument or (user.role == "BUSINESS" and instrument.owner_id != user.id):
        raise HTTPException(404, "Instrument not found")
    
    app_num = official_number(db, VerificationApplication, "application_number", "LM-APP", instrument.state)
    item = VerificationApplication(
        application_number=app_num,
        instrument_id=instrument.id,
        applicant_id=instrument.owner_id,
        **payload.model_dump(exclude={"instrument_id"})
    )
    db.add(item)
    db.flush()
    audit(db, user.id, "APPLICATION_CREATED", "application", item.application_number)
    db.commit()
    db.refresh(item)
    return item

@router.get("", response_model=list[ApplicationOut])
def list_all(
    q: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    query = db.query(VerificationApplication).order_by(VerificationApplication.created_at.desc())
    
    if user.role == "BUSINESS":
        query = query.filter(VerificationApplication.applicant_id == user.id)
    elif user.role in {"LMO", "GATC"}:
        # Include applications assigned to this officer or in review
        assigned_app_ids = (
            db.query(VerificationAssignment.application_id)
            .filter(VerificationAssignment.assigned_officer_id == user.id)
            .subquery()
        )
        query = query.filter(
            or_(
                VerificationApplication.id.in_(assigned_app_ids),
                VerificationApplication.status.in_(["SUBMITTED", "ASSIGNED", "IN_VERIFICATION"])
            )
        )
    
    if status:
        query = query.filter(VerificationApplication.status == status.upper())
    if q:
        query = query.filter(VerificationApplication.application_number.ilike(f"%{q}%"))
        
    return query.all()

@router.get("/{application_number}", response_model=ApplicationOut)
def read(application_number: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return fetch(db, application_number, user)

@router.put("/{application_number}", response_model=ApplicationOut)
def update(
    application_number: str,
    payload: ApplicationUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("BUSINESS", "ADMIN"))
):
    item = fetch(db, application_number, user)
    if item.status != "DRAFT":
        raise HTTPException(409, "Only draft applications can be edited")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    audit(db, user.id, "APPLICATION_UPDATED", "application", item.application_number)
    db.commit()
    db.refresh(item)
    return item

@router.post("/{application_number}/submit", response_model=ApplicationOut)
def submit(
    application_number: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("BUSINESS", "ADMIN"))
):
    item = fetch(db, application_number, user)
    if item.status != "DRAFT":
        raise HTTPException(409, "Only draft applications can be submitted")
    
    item.status = "SUBMITTED"
    instrument = db.get(Instrument, item.instrument_id)
    if instrument:
        # Automatic intelligent 18-category GATC vs Regional LMO routing
        route_verification_application(db, item, instrument, actor_id=user.id)
        
    audit(db, user.id, "APPLICATION_SUBMITTED", "application", item.application_number)
    db.commit()
    db.refresh(item)
    return item

@router.get("/{application_number}/routing-decision")
def get_routing_decision(
    application_number: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    item = fetch(db, application_number, user)
    instrument = db.get(Instrument, item.instrument_id)
    if not instrument:
        raise HTTPException(404, "Instrument not found")
    return route_verification_application(db, item, instrument, actor_id=user.id)


@router.post("/{application_number}/cancel", response_model=ApplicationOut)
def cancel(
    application_number: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("BUSINESS", "ADMIN"))
):
    item = fetch(db, application_number, user)
    if item.status in TERMINAL or item.status in {"IN_VERIFICATION", "APPROVED"}:
        raise HTTPException(409, "Application cannot be cancelled at this stage")
    item.status = "CANCELLED"
    audit(db, user.id, "APPLICATION_CANCELLED", "application", item.application_number)
    db.commit()
    db.refresh(item)
    return item

@router.post("/{application_number}/documents", status_code=status.HTTP_201_CREATED)
async def upload_application_document(
    application_number: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_role("BUSINESS", "ADMIN"))
):
    item = fetch(db, application_number, user)
    if user.role != "ADMIN" and item.applicant_id != user.id:
        raise HTTPException(403, "Not permitted")
    
    allowed = {"application/pdf", "image/jpeg", "image/png"}
    if file.content_type not in allowed:
        raise HTTPException(415, "Only PDF, JPEG, and PNG files are supported")
    
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(413, "File exceeds 10 MB limit")
    
    # Path traversal protection
    raw_name = Path(file.filename or "upload").name
    safe_suffix = Path(raw_name).suffix.lower()
    if safe_suffix not in {".pdf", ".jpg", ".jpeg", ".png"}:
        raise HTTPException(400, "Invalid file extension")
        
    directory = Path(__file__).resolve().parents[3] / "storage" / "application-documents"
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"{uuid4().hex}{safe_suffix}"
    path.write_bytes(content)
    
    rel_path = f"storage/application-documents/{path.name}"
    docs = list(item.supporting_documents or [])
    docs.append(rel_path)
    item.supporting_documents = docs
    db.commit()
    return {"application_number": item.application_number, "path": rel_path}
