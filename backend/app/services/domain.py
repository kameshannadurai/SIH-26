"""Shared business rules for identifiers, audit history, certificates and risk."""
from __future__ import annotations
import hashlib
import json
import secrets
from datetime import date, datetime, timedelta
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models import AuditLog, Instrument, VerificationApplication, VerificationCertificate, VerificationRecord


def official_number(db: Session, model: type, column: str, prefix: str, state: str | None = None) -> str:
    """Create a readable identifier; the unique DB constraint remains the concurrency safeguard."""
    year = datetime.utcnow().year
    count = db.query(func.count(model.id)).scalar() or 0
    region = f"-{state.upper()[:2]}" if state else ""
    return f"{prefix}{region}-{year}-{count + 1:06d}"


def audit(db: Session, actor_id: int | None, action: str, entity: str, entity_id: str, *, old_value: dict | None = None, new_value: dict | None = None) -> None:
    db.add(AuditLog(actor_id=actor_id, action=action, entity=entity, entity_id=entity_id, old_value=old_value, new_value=new_value))


def certificate_payload(certificate: VerificationCertificate, instrument: Instrument, application: VerificationApplication) -> dict:
    return {
        "certificate_number": certificate.certificate_number,
        "instrument_id": instrument.instrument_id,
        "application_number": application.application_number,
        "serial_number": instrument.serial_number,
        "valid_from": certificate.valid_from.isoformat(),
        "valid_until": certificate.valid_until.isoformat(),
        "result": certificate.result,
    }


def certificate_digest(certificate: VerificationCertificate, instrument: Instrument, application: VerificationApplication) -> str:
    canonical = json.dumps(certificate_payload(certificate, instrument, application), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


def issue_certificate(db: Session, verification: VerificationRecord, instrument: Instrument, application: VerificationApplication) -> VerificationCertificate:
    number = official_number(db, VerificationCertificate, "certificate_number", "LM-CERT")
    certificate = VerificationCertificate(
        certificate_number=number, instrument_id=instrument.id, application_id=application.id,
        verification_id=verification.id, valid_from=date.today(), valid_until=date.today() + timedelta(days=365),
        result="PASS", certificate_hash="pending", qr_token=secrets.token_urlsafe(24),
    )
    certificate.certificate_hash = certificate_digest(certificate, instrument, application)
    db.add(certificate)
    return certificate


def risk_for_instrument(db: Session, instrument: Instrument) -> tuple[int, str]:
    failures = db.query(func.count(VerificationRecord.id)).filter(VerificationRecord.instrument_id == instrument.id, VerificationRecord.result == "FAIL").scalar() or 0
    score = failures * 30
    if instrument.next_verification_due_date:
        days = (instrument.next_verification_due_date - date.today()).days
        score += 45 if days < 0 else 30 if days <= 7 else 15 if days <= 30 else 0
    score += 10 if instrument.category.upper() in {"HIGH_RISK", "FUEL", "MEDICAL"} else 0
    return score, "CRITICAL" if score >= 70 else "HIGH" if score >= 40 else "MEDIUM" if score >= 15 else "LOW"
