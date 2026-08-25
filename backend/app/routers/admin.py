from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import AuditLog, Instrument, VerificationApplication, VerificationCertificate, VerificationRecord
from app.models.user import User
from app.services.domain import risk_for_instrument
from app.utils.dependencies import require_role
router=APIRouter(prefix="/admin",tags=["Admin"])
@router.get("/dashboard")
def dashboard(db:Session=Depends(get_db),user:User=Depends(require_role("ADMIN"))):
    instruments=db.query(Instrument).all()
    risks=[risk_for_instrument(db,x)[1] for x in instruments]
    return {"total_instruments":len(instruments),"total_applications":db.query(func.count(VerificationApplication.id)).scalar(),"pending_verifications":db.query(func.count(VerificationApplication.id)).filter(VerificationApplication.status.in_(["ASSIGNED","IN_VERIFICATION"])).scalar(),"certificates_issued":db.query(func.count(VerificationCertificate.id)).scalar(),"certificates_expiring":db.query(func.count(VerificationCertificate.id)).filter(VerificationCertificate.valid_until.between(date.today(),date.today().fromordinal(date.today().toordinal()+30))).scalar(),"expired_certificates":db.query(func.count(VerificationCertificate.id)).filter(VerificationCertificate.valid_until<date.today()).scalar(),"risk_distribution":{x:risks.count(x) for x in {"LOW","MEDIUM","HIGH","CRITICAL"}}}
@router.get("/audit-logs")
def audit_logs(db:Session=Depends(get_db),user:User=Depends(require_role("ADMIN"))):
    return [{"id":x.id,"actor_id":x.actor_id,"action":x.action,"entity":x.entity,"entity_id":x.entity_id,"created_at":x.created_at} for x in db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(500).all()]
