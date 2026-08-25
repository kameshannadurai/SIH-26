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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    applications: Mapped[list["VerificationApplication"]] = relationship(back_populates="instrument")
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
    application_id: Mapped[int] = mapped_column(ForeignKey("verification_applications.id"), unique=True)
    verification_id: Mapped[int] = mapped_column(ForeignKey("verification_records.id"), unique=True)
    valid_from: Mapped[date] = mapped_column(Date)
    valid_until: Mapped[date] = mapped_column(Date, index=True)
    result: Mapped[str] = mapped_column(String(20))
    certificate_hash: Mapped[str] = mapped_column(String(64), unique=True)
    signed_hash: Mapped[str | None] = mapped_column(Text)
    qr_token: Mapped[str] = mapped_column(String(64), unique=True)
    pdf_path: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(20), default="VALID", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


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
