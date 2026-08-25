from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Instrument, VerificationApplication
from app.models.user import User
from app.schemas.platform import ApplicationCreate, ApplicationOut, ApplicationUpdate
from app.services.domain import audit, official_number
from app.utils.dependencies import get_current_user, require_role
router = APIRouter(prefix="/applications", tags=["Applications"])
TERMINAL = {"CANCELLED", "REJECTED", "CERTIFICATE_ISSUED"}
def fetch(db, number, user):
    item = db.query(VerificationApplication).filter(VerificationApplication.application_number == number).first()
    if not item or (user.role == "BUSINESS" and item.applicant_id != user.id): raise HTTPException(404, "Application not found")
    return item
@router.post("", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
def create(payload: ApplicationCreate, db: Session = Depends(get_db), user: User = Depends(require_role("BUSINESS", "ADMIN"))):
    instrument = db.query(Instrument).filter(Instrument.instrument_id == payload.instrument_id).first()
    if not instrument or (user.role == "BUSINESS" and instrument.owner_id != user.id): raise HTTPException(404, "Instrument not found")
    item = VerificationApplication(application_number=official_number(db, VerificationApplication, "application_number", "LM-APP"), instrument_id=instrument.id, applicant_id=instrument.owner_id, **payload.model_dump(exclude={"instrument_id"}))
    db.add(item); db.flush(); audit(db,user.id,"APPLICATION_CREATED","application",item.application_number); db.commit(); db.refresh(item); return item
@router.get("", response_model=list[ApplicationOut])
def list_all(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q=db.query(VerificationApplication).order_by(VerificationApplication.created_at.desc()); return q.filter(VerificationApplication.applicant_id==user.id).all() if user.role=="BUSINESS" else q.all()
@router.get("/{application_number}", response_model=ApplicationOut)
def read(application_number: str, db: Session=Depends(get_db), user: User=Depends(get_current_user)): return fetch(db,application_number,user)
@router.put("/{application_number}", response_model=ApplicationOut)
def update(application_number: str,payload: ApplicationUpdate,db: Session=Depends(get_db),user: User=Depends(require_role("BUSINESS","ADMIN"))):
    item=fetch(db,application_number,user)
    if item.status != "DRAFT": raise HTTPException(409,"Only draft applications can be edited")
    for k,v in payload.model_dump(exclude_unset=True).items(): setattr(item,k,v)
    audit(db,user.id,"APPLICATION_UPDATED","application",item.application_number); db.commit(); db.refresh(item); return item
@router.post("/{application_number}/submit", response_model=ApplicationOut)
def submit(application_number: str,db: Session=Depends(get_db),user: User=Depends(require_role("BUSINESS","ADMIN"))):
    item=fetch(db,application_number,user)
    if item.status != "DRAFT": raise HTTPException(409,"Only draft applications can be submitted")
    item.status="SUBMITTED"; audit(db,user.id,"APPLICATION_SUBMITTED","application",item.application_number); db.commit(); db.refresh(item); return item
@router.post("/{application_number}/cancel", response_model=ApplicationOut)
def cancel(application_number: str,db: Session=Depends(get_db),user: User=Depends(require_role("BUSINESS","ADMIN"))):
    item=fetch(db,application_number,user)
    if item.status in TERMINAL or item.status in {"IN_VERIFICATION","APPROVED"}: raise HTTPException(409,"Application cannot be cancelled at this stage")
    item.status="CANCELLED"; audit(db,user.id,"APPLICATION_CANCELLED","application",item.application_number); db.commit(); db.refresh(item); return item
