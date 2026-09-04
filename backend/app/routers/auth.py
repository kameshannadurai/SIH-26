from fastapi import APIRouter, Depends, HTTPException, status
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from app.utils.security import verify_password, create_access_token
from app.utils.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.utils.security import hash_password

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    existing_user = (
        db.query(User)
        .filter(User.email == user_data.email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered",
        )

    if user_data.role.upper() != "BUSINESS":
        raise HTTPException(status_code=403, detail="Only BUSINESS accounts may self-register")

    user = User(
        full_name=user_data.full_name,
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        role="BUSINESS",
        organization_name=user_data.organization_name,
        contact_number=user_data.contact_number,
        address=user_data.address,
        state=user_data.state,
        district=user_data.district,
        latitude=user_data.latitude,
        longitude=user_data.longitude,
        role_specific_info=user_data.role_specific_info,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


@router.post("/simulate-payment")
def simulate_payment(payload: dict):
    """Stub statutory payment gateway service for Business Registration & Verification applications."""
    import secrets
    from datetime import datetime
    
    amount = float(payload.get("amount", 708.0))
    purpose = payload.get("purpose", "BUSINESS_REGISTRATION")
    payment_method = payload.get("payment_method", "UPI / BharatPay")
    state = payload.get("state", "IN")
    
    txn_id = f"TXN-LM-2026-{secrets.token_hex(4).upper()}"
    challan_no = f"CHAL-{state.upper()[:2]}-2026-{secrets.randbelow(90000) + 10000}"
    
    return {
        "status": "SUCCESS",
        "transaction_id": txn_id,
        "challan_number": challan_no,
        "payment_gateway": f"Govt of India e-Challan / BharatPay Portal (Stub)",
        "amount": amount,
        "currency": "INR",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "purpose": purpose,
        "payment_method": payment_method,
        "statutory_reference": "Section 19 & 24, Legal Metrology Act, 2009 read with Schedule IX (Statutory Non-Refundable Fee)",
        "payer_name": payload.get("payer_name", "Authorized Signatory"),
        "establishment_name": payload.get("organization_name", "Registered Commercial Establishment")
    }


@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    from sqlalchemy import func
    clean_email = (form_data.username or "").strip().lower()
    user = (
        db.query(User)
        .filter(func.lower(User.email) == clean_email)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )


    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="User account is inactive",
        )

    access_token = create_access_token(
        {
            "sub": str(user.id),
            "role": user.role,
            "email": user.email,
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }
@router.get("/me", response_model=UserResponse)
def get_me(
    current_user: User = Depends(get_current_user),
):
    return current_user


@router.get("/profile", response_model=UserResponse)
def get_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/profile", response_model=UserResponse)
def update_profile(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, key, value)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/dashboard")
def get_dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from datetime import date, datetime, timedelta
    from sqlalchemy import func
    from app.models import Instrument, VerificationApplication, VerificationAssignment, VerificationCertificate, VerificationRecord

    if user.role == "ADMIN":
        instruments = db.query(Instrument).all()
        from app.services.domain import risk_for_instrument
        risks = [risk_for_instrument(db, x)[1] for x in instruments]
        
        total_stakeholders = {
            "BUSINESS": db.query(func.count(User.id)).filter(User.role == "BUSINESS").scalar() or 0,
            "LMO": db.query(func.count(User.id)).filter(User.role == "LMO").scalar() or 0,
            "GATC": db.query(func.count(User.id)).filter(User.role == "GATC").scalar() or 0,
            "ADMIN": db.query(func.count(User.id)).filter(User.role == "ADMIN").scalar() or 0,
        }
        
        return {
            "total_instruments": len(instruments),
            "total_applications": db.query(func.count(VerificationApplication.id)).scalar() or 0,
            "pending_verifications": db.query(func.count(VerificationApplication.id)).filter(VerificationApplication.status.in_(["ASSIGNED", "IN_VERIFICATION", "SUBMITTED", "UNDER_REVIEW", "SCHEDULED"])).scalar() or 0,
            "certificates_issued": db.query(func.count(VerificationCertificate.id)).scalar() or 0,
            "certificates_expiring": db.query(func.count(VerificationCertificate.id)).filter(VerificationCertificate.valid_until.between(date.today(), date.today() + timedelta(days=30))).scalar() or 0,
            "expired_certificates": db.query(func.count(VerificationCertificate.id)).filter(VerificationCertificate.valid_until < date.today()).scalar() or 0,
            "risk_distribution": {x: risks.count(x) for x in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}},
            "total_stakeholders": total_stakeholders,
        }
        
    elif user.role == "BUSINESS":
        total_instruments = db.query(func.count(Instrument.id)).filter(Instrument.owner_id == user.id).scalar() or 0
        valid_certificates = db.query(func.count(VerificationCertificate.id))\
            .join(Instrument)\
            .filter(Instrument.owner_id == user.id, VerificationCertificate.status == "VALID", VerificationCertificate.valid_until >= date.today())\
            .scalar() or 0
        expiring_certificates = db.query(func.count(VerificationCertificate.id))\
            .join(Instrument)\
            .filter(Instrument.owner_id == user.id, VerificationCertificate.status == "VALID", VerificationCertificate.valid_until.between(date.today(), date.today() + timedelta(days=30)))\
            .scalar() or 0
        expired_certificates = db.query(func.count(VerificationCertificate.id))\
            .join(Instrument)\
            .filter(Instrument.owner_id == user.id, (VerificationCertificate.valid_until < date.today()) | (VerificationCertificate.status == "EXPIRED"))\
            .scalar() or 0
        pending_applications = db.query(func.count(VerificationApplication.id))\
            .filter(VerificationApplication.applicant_id == user.id, ~VerificationApplication.status.in_(["CERTIFICATE_ISSUED", "REJECTED", "CANCELLED"]))\
            .scalar() or 0
        completed_verifications = db.query(func.count(VerificationRecord.id))\
            .join(VerificationApplication)\
            .filter(VerificationApplication.applicant_id == user.id, VerificationRecord.status == "APPROVED")\
            .scalar() or 0
            
        return {
            "total_instruments": total_instruments,
            "valid_certificates": valid_certificates,
            "expiring_certificates": expiring_certificates,
            "expired_certificates": expired_certificates,
            "pending_applications": pending_applications,
            "completed_verifications": completed_verifications,
        }
        
    elif user.role in {"LMO", "GATC"}:
        assigned_inspections = db.query(func.count(VerificationAssignment.id)).filter(VerificationAssignment.assigned_officer_id == user.id, VerificationAssignment.status == "ASSIGNED").scalar() or 0
        today_start = datetime.combine(date.today(), datetime.min.time())
        today_end = datetime.combine(date.today(), datetime.max.time())
        todays_activities = db.query(func.count(VerificationAssignment.id)).filter(
            VerificationAssignment.assigned_officer_id == user.id,
            VerificationAssignment.scheduled_at.between(today_start, today_end)
        ).scalar() or 0
        pending_verification = db.query(func.count(VerificationAssignment.id)).filter(
            VerificationAssignment.assigned_officer_id == user.id,
            VerificationAssignment.status.in_(["ASSIGNED", "ACCEPTED"])
        ).scalar() or 0
        completed_verification = db.query(func.count(VerificationRecord.id)).filter(
            VerificationRecord.officer_id == user.id,
            VerificationRecord.status == "APPROVED"
        ).scalar() or 0
        failed_verification = db.query(func.count(VerificationRecord.id)).filter(
            VerificationRecord.officer_id == user.id,
            VerificationRecord.result == "FAIL"
        ).scalar() or 0
        expiring_assignments = db.query(func.count(VerificationAssignment.id)).filter(
            VerificationAssignment.assigned_officer_id == user.id,
            VerificationAssignment.status == "ASSIGNED",
            VerificationAssignment.scheduled_at.between(datetime.utcnow(), datetime.utcnow() + timedelta(days=2))
        ).scalar() or 0
        
        if user.role == "GATC":
            categories_count = db.query(Instrument.category, func.count(Instrument.id))\
                .join(VerificationRecord, VerificationRecord.instrument_id == Instrument.id)\
                .filter(VerificationRecord.officer_id == user.id)\
                .group_by(Instrument.category).all()
            categories_summary = {cat: count for cat, count in categories_count}
            fees_collected = completed_verification * 1500
            
            return {
                "assigned_inspections": assigned_inspections,
                "todays_activities": todays_activities,
                "pending_verification": pending_verification,
                "completed_verification": completed_verification,
                "failed_verification": failed_verification,
                "expiring_assignments": expiring_assignments,
                "instrument_categories": categories_summary,
                "fees_collected": fees_collected,
            }
            
        return {
            "assigned_inspections": assigned_inspections,
            "todays_activities": todays_activities,
            "pending_verification": pending_verification,
            "completed_verification": completed_verification,
            "failed_verification": failed_verification,
            "expiring_assignments": expiring_assignments,
        }

