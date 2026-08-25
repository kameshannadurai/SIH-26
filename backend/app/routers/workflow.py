from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, status
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import (CertificateVerification, EnforcementRecord, Instrument, LocationRecord, Notification, VerificationApplication, VerificationAssignment, VerificationCertificate, VerificationMeasurement, VerificationObservation, VerificationRecord)
from app.models.user import User
from app.schemas.platform import AssignmentCreate, AssignmentUpdate, EnforcementCreate, VerificationCreate, VerificationUpdate
from app.services.domain import audit, certificate_digest, issue_certificate
from app.utils.dependencies import get_current_user, require_role

assignments = APIRouter(prefix="/assignments", tags=["Assignments"])
verifications = APIRouter(prefix="/verifications", tags=["Verifications"])
certificates = APIRouter(prefix="/certificates", tags=["Certificates"])
notifications = APIRouter(prefix="/notifications", tags=["Notifications"])
enforcement = APIRouter(prefix="/enforcement", tags=["Enforcement"])
public = APIRouter(prefix="/public", tags=["Public Verification"])
ai = APIRouter(prefix="/ai", tags=["AI Assistance"])

@assignments.post("", status_code=status.HTTP_201_CREATED)
def create_assignment(payload: AssignmentCreate, db: Session=Depends(get_db), user: User=Depends(require_role("ADMIN"))):
    application=db.query(VerificationApplication).filter_by(application_number=payload.application_number).first()
    officer=db.query(User).filter_by(id=payload.assigned_officer_id).first()
    if not application: raise HTTPException(404,"Application not found")
    if application.status not in {"SUBMITTED","UNDER_REVIEW","SCHEDULED"}: raise HTTPException(409,"Application is not ready for assignment")
    if not officer or officer.role not in {"LMO","GATC"}: raise HTTPException(422,"Assigned officer must be an active LMO or GATC user")
    window_start=payload.scheduled_at-timedelta(hours=1); window_end=payload.scheduled_at+timedelta(hours=1)
    conflict=db.query(VerificationAssignment).filter(VerificationAssignment.assigned_officer_id==officer.id, VerificationAssignment.status.in_(["ASSIGNED","ACCEPTED"]), VerificationAssignment.scheduled_at.between(window_start,window_end)).first()
    if conflict: raise HTTPException(409,"Officer has an overlapping assignment")
    assignment=VerificationAssignment(application_id=application.id,assigned_officer_id=officer.id,centre_id=payload.centre_id,scheduled_at=payload.scheduled_at,location=payload.location,priority=payload.priority.upper(),created_by_id=user.id)
    application.status="ASSIGNED"; db.add(assignment); db.add(Notification(user_id=officer.id,title="New verification assignment",message=f"You have been assigned {application.application_number}",severity=assignment.priority)); db.flush(); audit(db,user.id,"ASSIGNMENT_CREATED","assignment",str(assignment.id)); db.commit(); return {"id":assignment.id,"status":assignment.status}
@assignments.get("")
def list_assignments(db: Session=Depends(get_db),user: User=Depends(get_current_user)):
    q=db.query(VerificationAssignment).order_by(VerificationAssignment.scheduled_at); q=q.filter_by(assigned_officer_id=user.id) if user.role in {"LMO","GATC"} else q
    return [{"id":a.id,"application_id":a.application_id,"officer_id":a.assigned_officer_id,"scheduled_at":a.scheduled_at,"status":a.status,"priority":a.priority} for a in q.all()]
@assignments.put("/{assignment_id}")
def update_assignment(assignment_id:int,payload:AssignmentUpdate,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    a=db.get(VerificationAssignment,assignment_id)
    if not a: raise HTTPException(404,"Assignment not found")
    if user.role not in {"ADMIN"} and a.assigned_officer_id!=user.id: raise HTTPException(403,"Not permitted")
    if user.role != "ADMIN" and payload.status not in {"ACCEPTED","REJECTED"}: raise HTTPException(403,"Officers may only accept or reject assignments")
    for k,v in payload.model_dump(exclude_none=True).items(): setattr(a,k,v.upper() if k in {"status","priority"} else v)
    audit(db,user.id,"ASSIGNMENT_UPDATED","assignment",str(a.id)); db.commit(); return {"id":a.id,"status":a.status}
@assignments.post("/{assignment_id}/complete")
def complete_assignment(assignment_id:int,db:Session=Depends(get_db),user:User=Depends(require_role("LMO","GATC","ADMIN"))):
    a=db.get(VerificationAssignment,assignment_id)
    if not a or (user.role!="ADMIN" and a.assigned_officer_id!=user.id): raise HTTPException(404,"Assignment not found")
    a.status="COMPLETED"; audit(db,user.id,"ASSIGNMENT_COMPLETED","assignment",str(a.id)); db.commit(); return {"success":True}

def get_record(db, record_id, user):
    item=db.get(VerificationRecord,record_id)
    if not item or (user.role not in {"ADMIN"} and item.officer_id!=user.id): raise HTTPException(404,"Verification not found")
    return item
@verifications.post("",status_code=status.HTTP_201_CREATED)
def start_verification(payload:VerificationCreate,db:Session=Depends(get_db),user:User=Depends(require_role("LMO","GATC","ADMIN"))):
    app=db.query(VerificationApplication).filter_by(application_number=payload.application_number).first()
    if not app: raise HTTPException(404,"Application not found")
    assigned=db.query(VerificationAssignment).filter_by(application_id=app.id,assigned_officer_id=user.id).first()
    if user.role!="ADMIN" and not assigned: raise HTTPException(403,"No assignment for this application")
    if db.query(VerificationRecord).filter_by(application_id=app.id).first(): raise HTTPException(409,"Verification already exists")
    record=VerificationRecord(application_id=app.id,instrument_id=app.instrument_id,officer_id=user.id,latitude=payload.latitude,longitude=payload.longitude,remarks=payload.remarks)
    db.add(record); db.flush()
    for text in payload.observations: db.add(VerificationObservation(verification_id=record.id,observation=text))
    for m in payload.measurements: db.add(VerificationMeasurement(verification_id=record.id,**m.model_dump()))
    if payload.latitude is not None: db.add(LocationRecord(instrument_id=app.instrument_id,verification_id=record.id,latitude=payload.latitude,longitude=payload.longitude))
    app.status="IN_VERIFICATION"; audit(db,user.id,"VERIFICATION_STARTED","verification",str(record.id)); db.commit(); return {"id":record.id,"status":record.status}
@verifications.get("/{record_id}")
def get_verification(record_id:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    r=get_record(db,record_id,user); return {"id":r.id,"status":r.status,"result":r.result,"remarks":r.remarks,"measurements":[{"parameter":m.parameter,"observed_value":m.observed_value,"unit":m.unit,"within_tolerance":m.within_tolerance} for m in r.measurements],"observations":[o.observation for o in r.observations]}
@verifications.put("/{record_id}")
def update_verification(record_id:int,payload:VerificationUpdate,db:Session=Depends(get_db),user:User=Depends(require_role("LMO","GATC","ADMIN"))):
    r=get_record(db,record_id,user)
    if r.status!="IN_PROGRESS": raise HTTPException(409,"Completed verification is immutable")
    for k in ("latitude","longitude","remarks"):
        v=getattr(payload,k)
        if v is not None:setattr(r,k,v)
    if payload.observations is not None:
        r.observations.clear(); [r.observations.append(VerificationObservation(observation=x)) for x in payload.observations]
    if payload.measurements is not None:
        r.measurements.clear(); [r.measurements.append(VerificationMeasurement(**x.model_dump())) for x in payload.measurements]
    audit(db,user.id,"VERIFICATION_UPDATED","verification",str(r.id)); db.commit(); return {"id":r.id,"status":r.status}
@verifications.post("/{record_id}/approve")
def approve(record_id:int,db:Session=Depends(get_db),user:User=Depends(require_role("LMO","GATC","ADMIN"))):
    r=get_record(db,record_id,user)
    if r.status!="IN_PROGRESS": raise HTTPException(409,"Verification already finalised")
    app=db.get(VerificationApplication,r.application_id); instrument=db.get(Instrument,r.instrument_id)
    r.result="PASS"; r.status="APPROVED"; app.status="CERTIFICATE_ISSUED"; instrument.status="VERIFIED"; instrument.next_verification_due_date=date.today()+timedelta(days=365)
    cert=issue_certificate(db,r,instrument,app); db.add(Notification(user_id=app.applicant_id,title="Certificate issued",message=f"Certificate {cert.certificate_number} is ready.")); audit(db,user.id,"VERIFICATION_APPROVED","verification",str(r.id)); audit(db,user.id,"CERTIFICATE_ISSUED","certificate",cert.certificate_number); db.commit(); return {"verification_id":r.id,"certificate_number":cert.certificate_number,"certificate_hash":cert.certificate_hash}
@verifications.post("/{record_id}/reject")
def reject(record_id:int,db:Session=Depends(get_db),user:User=Depends(require_role("LMO","GATC","ADMIN"))):
    r=get_record(db,record_id,user)
    if r.status!="IN_PROGRESS": raise HTTPException(409,"Verification already finalised")
    r.result="FAIL";r.status="REJECTED";app=db.get(VerificationApplication,r.application_id);app.status="REJECTED";db.get(Instrument,r.instrument_id).status="REJECTED";audit(db,user.id,"VERIFICATION_REJECTED","verification",str(r.id));db.commit();return {"verification_id":r.id,"result":"FAIL"}

@certificates.get("")
def list_certificates(db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    q=db.query(VerificationCertificate).order_by(VerificationCertificate.created_at.desc())
    if user.role=="BUSINESS": q=q.join(Instrument).filter(Instrument.owner_id==user.id)
    return [{"certificate_number":c.certificate_number,"valid_until":c.valid_until,"status":c.status,"certificate_hash":c.certificate_hash} for c in q.all()]

def public_certificate(db:Session,number:str,request:Request|None=None):
    c=db.query(VerificationCertificate).filter_by(certificate_number=number).first()
    if not c: raise HTTPException(404,"Certificate not found")
    instrument=db.get(Instrument,c.instrument_id); app=db.get(VerificationApplication,c.application_id)
    digest_ok=certificate_digest(c,instrument,app)==c.certificate_hash
    valid=c.status=="VALID" and c.valid_until>=date.today() and digest_ok
    db.add(CertificateVerification(certificate_id=c.id,valid=valid,requester_ip=request.client.host if request and request.client else None));db.commit()
    return {"valid":valid,"certificate_number":c.certificate_number,"instrument_id":instrument.instrument_id,"instrument_type":instrument.instrument_type,"manufacturer":instrument.manufacturer,"verification_date":c.valid_from,"valid_until":c.valid_until,"status":"VALID" if valid else "INVALID","certificate_hash_verified":digest_ok}
@public.get("/verify/{certificate_number}")
def verify_public(certificate_number:str,request:Request,db:Session=Depends(get_db)): return public_certificate(db,certificate_number,request)
@public.get("/verify/{certificate_number}/page", response_class=HTMLResponse, include_in_schema=False)
def verification_page(certificate_number:str):
    # Fetching client-side keeps the public page free of internal API data.
    return f"<!doctype html><title>Certificate Verification</title><main><h1>Legal Metrology Certificate</h1><p id='result'>Checking certificate…</p></main><script>fetch('/public/verify/{certificate_number}').then(r=>r.json()).then(x=>document.getElementById('result').textContent=(x.valid?'VALID':'INVALID')+' — '+(x.certificate_number||''))</script>"
@certificates.get("/{certificate_number}/verify")
def verify_authenticated(certificate_number:str,request:Request,db:Session=Depends(get_db),user:User=Depends(get_current_user)): return public_certificate(db,certificate_number,request)

@notifications.get("")
def list_notifications(db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    return [{"id":n.id,"title":n.title,"message":n.message,"severity":n.severity,"is_read":n.is_read,"created_at":n.created_at} for n in db.query(Notification).filter_by(user_id=user.id).order_by(Notification.created_at.desc()).all()]
@notifications.post("/{notification_id}/read")
def read_notification(notification_id:int,db:Session=Depends(get_db),user:User=Depends(get_current_user)):
    n=db.query(Notification).filter_by(id=notification_id,user_id=user.id).first()
    if not n: raise HTTPException(404,"Notification not found")
    n.is_read=True;db.commit();return {"success":True}

@enforcement.post("",status_code=status.HTTP_201_CREATED)
def create_enforcement(payload:EnforcementCreate,db:Session=Depends(get_db),user:User=Depends(require_role("LMO","GATC","ADMIN"))):
    instrument=db.query(Instrument).filter_by(instrument_id=payload.instrument_id).first()
    if not instrument: raise HTTPException(404,"Instrument not found")
    record=EnforcementRecord(instrument_id=instrument.id,officer_id=user.id,**payload.model_dump(exclude={"instrument_id"}));db.add(record);db.flush();audit(db,user.id,"ENFORCEMENT_RECORDED","enforcement",str(record.id));db.commit();return {"id":record.id}
@enforcement.get("")
def list_enforcement(db:Session=Depends(get_db),user:User=Depends(require_role("ADMIN"))):
    return [{"id":x.id,"instrument_id":x.instrument_id,"violation_type":x.violation_type,"severity":x.severity,"recorded_at":x.recorded_at} for x in db.query(EnforcementRecord).order_by(EnforcementRecord.recorded_at.desc()).all()]

@ai.post("/instrument-extract")
async def assist_instrument_extract(image: UploadFile = File(...), user: User = Depends(require_role("LMO", "GATC", "ADMIN"))):
    if image.content_type not in {"image/jpeg", "image/png"}: raise HTTPException(415, "JPEG or PNG image required")
    data = await image.read()
    if len(data) > 10 * 1024 * 1024: raise HTTPException(413, "Image exceeds 10 MB limit")
    from app.services.ai_assist import InstrumentAiAssistant
    return InstrumentAiAssistant().extract(data).__dict__ | {"requires_officer_confirmation": True}
