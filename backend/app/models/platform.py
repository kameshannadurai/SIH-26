"""Core Legal Metrology domain models.

Public identifiers (not numeric primary keys) are used in all external APIs.
"""
from __future__ import annotations

from datetime import date, datetime
from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Instrument(Base):
    __tablename__ = "instruments"
    id: Mapped[int] = mapped_column(primary_key=True)
    instrument_id: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    instrument_type: Mapped[str] = mapped_column(String(100))
    category: Mapped[str] = mapped_column(String(100))
    manufacturer: Mapped[str] = mapped_column(String(150))
    model: Mapped[str] = mapped_column(String(150))
    serial_number: Mapped[str] = mapped_column(String(150), unique=True, index=True)
    capacity: Mapped[str | None] = mapped_column(String(100))
    accuracy_class: Mapped[str | None] = mapped_column(String(100))
    measurement_unit: Mapped[str | None] = mapped_column(String(50))
    year_of_manufacture: Mapped[int | None] = mapped_column(Integer)
    owner_name: Mapped[str] = mapped_column(String(150))
    owner_address: Mapped[str | None] = mapped_column(Text)
    state: Mapped[str] = mapped_column(String(100), index=True)
    district: Mapped[str] = mapped_column(String(100), index=True)
    location: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="ACTIVE", index=True)
    registration_date: Mapped[date] = mapped_column(Date, default=date.today)
    next_verification_due_date: Mapped[date | None] = mapped_column(Date, index=True)
    last_verification_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    installation_details: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    applications: Mapped[list["VerificationApplication"]] = relationship(back_populates="instrument")
    certificates: Mapped[list["VerificationCertificate"]] = relationship(back_populates="instrument")
    documents: Mapped[list["InstrumentDocument"]] = relationship(back_populates="instrument", cascade="all, delete-orphan")
    photos: Mapped[list["InstrumentPhoto"]] = relationship(back_populates="instrument", cascade="all, delete-orphan")


class InstrumentDocument(Base):
    __tablename__ = "instrument_documents"
    id: Mapped[int] = mapped_column(primary_key=True)
    instrument_id: Mapped[int] = mapped_column(ForeignKey("instruments.id"), index=True)
    storage_path: Mapped[str] = mapped_column(String(500))
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    uploaded_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    instrument: Mapped[Instrument] = relationship(back_populates="documents")


class InstrumentPhoto(Base):
    __tablename__ = "instrument_photos"
    id: Mapped[int] = mapped_column(primary_key=True)
    instrument_id: Mapped[int] = mapped_column(ForeignKey("instruments.id"), index=True)
    storage_path: Mapped[str] = mapped_column(String(500))
    caption: Mapped[str | None] = mapped_column(String(255))
    uploaded_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    instrument: Mapped[Instrument] = relationship(back_populates="photos")


class VerificationApplication(Base):
    __tablename__ = "verification_applications"
    id: Mapped[int] = mapped_column(primary_key=True)
    application_number: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    instrument_id: Mapped[int] = mapped_column(ForeignKey("instruments.id"), index=True)
    applicant_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    application_type: Mapped[str] = mapped_column(String(30))
    requested_date: Mapped[date | None] = mapped_column(Date)
    preferred_location: Mapped[str | None] = mapped_column(Text)
    remarks: Mapped[str | None] = mapped_column(Text)
    supporting_documents: Mapped[list | None] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(32), default="DRAFT", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    instrument: Mapped[Instrument] = relationship(back_populates="applications")
    assignments: Mapped[list["VerificationAssignment"]] = relationship(back_populates="application")


class VerificationAssignment(Base):
    __tablename__ = "verification_assignments"
    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("verification_applications.id"), index=True)
    assigned_officer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    centre_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    scheduled_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    location: Mapped[str | None] = mapped_column(Text)
    priority: Mapped[str] = mapped_column(String(20), default="NORMAL")
    status: Mapped[str] = mapped_column(String(30), default="ASSIGNED", index=True)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    application: Mapped[VerificationApplication] = relationship(back_populates="assignments")


class VerificationRecord(Base):
    __tablename__ = "verification_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("verification_applications.id"), unique=True, index=True)
    instrument_id: Mapped[int] = mapped_column(ForeignKey("instruments.id"), index=True)
    officer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    verified_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    remarks: Mapped[str | None] = mapped_column(Text)
    result: Mapped[str | None] = mapped_column(String(20), index=True)
    status: Mapped[str] = mapped_column(String(30), default="IN_PROGRESS")
    evidence_paths: Mapped[list | None] = mapped_column(JSON, nullable=True)
    evidence_metadata: Mapped[list | None] = mapped_column(JSON, nullable=True)
    standards_used: Mapped[str | None] = mapped_column(Text, nullable=True)
    defects_found: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    observations: Mapped[list["VerificationObservation"]] = relationship(back_populates="verification", cascade="all, delete-orphan")
    measurements: Mapped[list["VerificationMeasurement"]] = relationship(back_populates="verification", cascade="all, delete-orphan")


class VerificationObservation(Base):
    __tablename__ = "verification_observations"
    id: Mapped[int] = mapped_column(primary_key=True)
    verification_id: Mapped[int] = mapped_column(ForeignKey("verification_records.id"), index=True)
    observation: Mapped[str] = mapped_column(Text)
    is_non_compliant: Mapped[bool] = mapped_column(Boolean, default=False)
    verification: Mapped[VerificationRecord] = relationship(back_populates="observations")


class VerificationMeasurement(Base):
    __tablename__ = "verification_measurements"
    id: Mapped[int] = mapped_column(primary_key=True)
    verification_id: Mapped[int] = mapped_column(ForeignKey("verification_records.id"), index=True)
    parameter: Mapped[str] = mapped_column(String(100))
    observed_value: Mapped[float] = mapped_column(Float)
    expected_value: Mapped[float | None] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(30))
    within_tolerance: Mapped[bool] = mapped_column(Boolean, default=True)
    verification: Mapped[VerificationRecord] = relationship(back_populates="measurements")


class VerificationCertificate(Base):
    __tablename__ = "verification_certificates"
    id: Mapped[int] = mapped_column(primary_key=True)
    certificate_number: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    instrument_id: Mapped[int] = mapped_column(ForeignKey("instruments.id"), index=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("verification_applications.id"), index=True)
    verification_id: Mapped[int] = mapped_column(ForeignKey("verification_records.id"), unique=True)
    valid_from: Mapped[date] = mapped_column(Date)
    valid_until: Mapped[date] = mapped_column(Date, index=True)
    result: Mapped[str] = mapped_column(String(20))
    certificate_hash: Mapped[str] = mapped_column(String(64), unique=True)
    signed_hash: Mapped[str | None] = mapped_column(Text)
    qr_token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    pdf_path: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(20), default="VALID", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    issuing_officer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    revocation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    revoked_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    instrument: Mapped[Instrument] = relationship(back_populates="certificates")


class CertificateVerification(Base):
    __tablename__ = "certificate_verifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    certificate_id: Mapped[int] = mapped_column(ForeignKey("verification_certificates.id"), index=True)
    verified_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    valid: Mapped[bool] = mapped_column(Boolean)
    requester_ip: Mapped[str | None] = mapped_column(String(64))


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(20), default="NORMAL")
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(100), index=True)
    entity: Mapped[str] = mapped_column(String(100), index=True)
    entity_id: Mapped[str] = mapped_column(String(100), index=True)
    old_value: Mapped[dict | None] = mapped_column(JSON)
    new_value: Mapped[dict | None] = mapped_column(JSON)
    metadata_json: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class LocationRecord(Base):
    __tablename__ = "location_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    instrument_id: Mapped[int | None] = mapped_column(ForeignKey("instruments.id"), index=True)
    verification_id: Mapped[int | None] = mapped_column(ForeignKey("verification_records.id"), index=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    device_id: Mapped[str | None] = mapped_column(String(255))
    captured_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class EnforcementRecord(Base):
    __tablename__ = "enforcement_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    instrument_id: Mapped[int] = mapped_column(ForeignKey("instruments.id"), index=True)
    officer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    violation_type: Mapped[str] = mapped_column(String(150))
    severity: Mapped[str] = mapped_column(String(20), index=True)
    notes: Mapped[str | None] = mapped_column(Text)
    action_taken: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(Text)
    evidence_paths: Mapped[list | None] = mapped_column(JSON)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


Index("ix_assignments_officer_schedule", VerificationAssignment.assigned_officer_id, VerificationAssignment.scheduled_at)
UniqueConstraint(VerificationAssignment.application_id, VerificationAssignment.assigned_officer_id, name="uq_assignment_application_officer")


# ==============================================================================
# SMART DIGITAL ECOSYSTEM UPGRADE MODELS (ADDITIVE)
# ==============================================================================

class OfficerAvailability(Base):
    __tablename__ = "officer_availability"
    id: Mapped[int] = mapped_column(primary_key=True)
    officer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    day_of_week: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 0=Mon, 6=Sun
    start_time: Mapped[str] = mapped_column(String(10), default="09:00")
    end_time: Mapped[str] = mapped_column(String(10), default="17:00")
    slot_duration_minutes: Mapped[int] = mapped_column(Integer, default=60)
    max_daily_inspections: Mapped[int] = mapped_column(Integer, default=8)
    break_start: Mapped[str | None] = mapped_column(String(10), default="13:00", nullable=True)
    break_end: Mapped[str | None] = mapped_column(String(10), default="14:00", nullable=True)
    specific_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    is_unavailable: Mapped[bool] = mapped_column(Boolean, default=False)
    location_jurisdiction: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class InspectionSlot(Base):
    __tablename__ = "inspection_slots"
    id: Mapped[int] = mapped_column(primary_key=True)
    officer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    application_id: Mapped[int | None] = mapped_column(ForeignKey("verification_applications.id"), nullable=True, index=True)
    booked_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    slot_date: Mapped[date] = mapped_column(Date, index=True)
    start_time: Mapped[str] = mapped_column(String(10))  # e.g. "09:00"
    end_time: Mapped[str] = mapped_column(String(10))    # e.g. "10:00"
    status: Mapped[str] = mapped_column(String(20), default="AVAILABLE", index=True)  # AVAILABLE, LOCKED, BOOKED, COMPLETED, CANCELLED
    lock_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    location: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CitizenComplaint(Base):
    __tablename__ = "citizen_complaints"
    id: Mapped[int] = mapped_column(primary_key=True)
    complaint_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)  # COMP-TN-2026-000001
    citizen_name: Mapped[str] = mapped_column(String(150))
    id_reference_token: Mapped[str | None] = mapped_column(String(100), nullable=True)
    verified_phone: Mapped[str] = mapped_column(String(30), index=True)
    shop_name: Mapped[str] = mapped_column(String(200), index=True)
    shop_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    state: Mapped[str] = mapped_column(String(100), index=True)
    district: Mapped[str] = mapped_column(String(100), index=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    instrument_id: Mapped[int | None] = mapped_column(ForeignKey("instruments.id"), nullable=True, index=True)
    instrument_category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    complaint_category: Mapped[str] = mapped_column(String(100), default="INCORRECT_WEIGHT")
    violation_type: Mapped[str] = mapped_column(String(150))
    description: Mapped[str] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(20), default="MEDIUM", index=True)  # LOW, MEDIUM, HIGH, CRITICAL
    status: Mapped[str] = mapped_column(String(30), default="SUBMITTED", index=True)  # SUBMITTED, AUTO_CLASSIFIED, ASSIGNED, IN_INVESTIGATION, ACTION_TAKEN, RESOLVED, DISMISSED
    assigned_officer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    is_repeat_offender: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    risk_score: Mapped[int] = mapped_column(Integer, default=20)
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    action_taken: Mapped[str | None] = mapped_column(Text, nullable=True)
    entry_method: Mapped[str] = mapped_column(String(20), default="PORTAL")  # QR_SCAN or PORTAL
    qr_token_used: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    evidence: Mapped[list["ComplaintEvidence"]] = relationship(back_populates="complaint", cascade="all, delete-orphan")
    timeline: Mapped[list["ComplaintTimeline"]] = relationship(back_populates="complaint", cascade="all, delete-orphan")


class ComplaintEvidence(Base):
    __tablename__ = "complaint_evidence"
    id: Mapped[int] = mapped_column(primary_key=True)
    complaint_id: Mapped[int] = mapped_column(ForeignKey("citizen_complaints.id"), index=True)
    storage_path: Mapped[str] = mapped_column(String(500))
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    evidence_type: Mapped[str] = mapped_column(String(50), default="PHOTO")  # SHOP_PHOTO, INSTRUMENT_PHOTO, READING_PHOTO, RECEIPT, DOCUMENT, VIDEO
    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    complaint: Mapped[CitizenComplaint] = relationship(back_populates="evidence")


class ComplaintTimeline(Base):
    __tablename__ = "complaint_timelines"
    id: Mapped[int] = mapped_column(primary_key=True)
    complaint_id: Mapped[int] = mapped_column(ForeignKey("citizen_complaints.id"), index=True)
    action: Mapped[str] = mapped_column(String(100))
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    actor_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    actor_role: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    old_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    new_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    complaint: Mapped[CitizenComplaint] = relationship(back_populates="timeline")


class OTPVerification(Base):
    __tablename__ = "otp_verifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    phone_number: Mapped[str] = mapped_column(String(30), index=True)
    otp_code: Mapped[str] = mapped_column(String(10))
    verification_token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    attempts_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ShopRegistry(Base):
    __tablename__ = "shop_registry"
    id: Mapped[int] = mapped_column(primary_key=True)
    shop_name: Mapped[str] = mapped_column(String(200), index=True)
    registration_number: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True, index=True)
    owner_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    contact_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    state: Mapped[str] = mapped_column(String(100), index=True)
    district: Mapped[str] = mapped_column(String(100), index=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    risk_score: Mapped[int] = mapped_column(Integer, default=10, index=True)
    complaint_count: Mapped[int] = mapped_column(Integer, default=0)
    violation_count: Mapped[int] = mapped_column(Integer, default=0)
    last_inspection_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

