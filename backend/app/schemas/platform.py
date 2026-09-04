from __future__ import annotations
from datetime import date, datetime
from typing import Generic, TypeVar
from pydantic import BaseModel, ConfigDict, Field, field_validator

VALID_ROLES = {"BUSINESS", "LMO", "GATC", "ADMIN"}

T = TypeVar("T")

class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int
    total_pages: int

class InstrumentCreate(BaseModel):
    instrument_type: str = Field(min_length=2, max_length=100)
    category: str = Field(min_length=2, max_length=100)
    manufacturer: str = Field(min_length=2, max_length=150)
    model: str = Field(min_length=1, max_length=150)
    serial_number: str = Field(min_length=1, max_length=150)
    capacity: str | None = None
    accuracy_class: str | None = None
    measurement_unit: str | None = None
    year_of_manufacture: int | None = Field(default=None, ge=1800, le=2100)
    owner_name: str = Field(min_length=2, max_length=150)
    owner_address: str | None = None
    state: str = Field(min_length=2, max_length=100)
    district: str = Field(min_length=2, max_length=100)
    location: str | None = None
    last_verification_date: date | None = None
    installation_details: str | None = None

class InstrumentUpdate(InstrumentCreate):
    pass

class InstrumentOut(InstrumentCreate):
    model_config = ConfigDict(from_attributes=True)
    instrument_id: str
    status: str
    registration_date: date
    next_verification_due_date: date | None = None
    last_verification_date: date | None = None
    installation_details: str | None = None

class ApplicationCreate(BaseModel):
    instrument_id: str
    application_type: str = "VERIFICATION"
    requested_date: date | None = None
    preferred_location: str | None = None
    remarks: str | None = None
    supporting_documents: list[str] | None = None

    @field_validator("application_type")
    @classmethod
    def valid_type(cls, value: str) -> str:
        value = value.upper()
        if value not in {"VERIFICATION", "RE_VERIFICATION"}:
            raise ValueError("application_type must be VERIFICATION or RE_VERIFICATION")
        return value

class ApplicationUpdate(BaseModel):
    requested_date: date | None = None
    preferred_location: str | None = None
    remarks: str | None = None
    supporting_documents: list[str] | None = None

class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    application_number: str
    instrument_id: int | None = None
    applicant_id: int | None = None
    application_type: str
    status: str
    requested_date: date | None
    preferred_location: str | None
    remarks: str | None
    created_at: datetime

class AssignmentCreate(BaseModel):
    application_number: str
    assigned_officer_id: int
    centre_id: int | None = None
    scheduled_at: datetime
    location: str | None = None
    priority: str = "NORMAL"

class AssignmentUpdate(BaseModel):
    scheduled_at: datetime | None = None
    location: str | None = None
    priority: str | None = None
    status: str | None = None

class MeasurementIn(BaseModel):
    parameter: str
    observed_value: float
    expected_value: float | None = None
    unit: str
    within_tolerance: bool = True

class EvidenceMetadataItem(BaseModel):
    path: str
    filename: str
    latitude: float | None = None
    longitude: float | None = None
    captured_at: str | None = None

class VerificationCreate(BaseModel):
    application_number: str
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    remarks: str | None = None
    observations: list[str] = []
    measurements: list[MeasurementIn] = []
    standards_used: str | None = None
    defects_found: str | None = None

class VerificationUpdate(BaseModel):
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    remarks: str | None = None
    observations: list[str] | None = None
    measurements: list[MeasurementIn] | None = None
    standards_used: str | None = None
    defects_found: str | None = None

class CertificateRevokeRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)

class CertificateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    certificate_number: str
    instrument_id: int
    application_id: int
    valid_from: date
    valid_until: date
    status: str
    certificate_hash: str
    qr_token: str
    created_at: datetime
    issuing_officer_id: int | None = None
    revocation_reason: str | None = None
    revoked_at: datetime | None = None

class PublicCertificateOut(BaseModel):
    valid: bool
    certificate_number: str
    instrument_id: str
    instrument_type: str
    category: str | None = None
    manufacturer: str
    model: str | None = None
    serial_number: str | None = None
    verification_date: date
    valid_until: date
    status: str
    certificate_hash_verified: bool
    qr_token: str
    issuing_authority: str = "Legal Metrology Department, Government of India"
    revocation_reason: str | None = None

class DueTrackingItem(BaseModel):
    instrument_id: str
    serial_number: str
    instrument_type: str
    category: str
    manufacturer: str
    owner_name: str
    state: str
    district: str
    next_verification_due_date: date | None
    days_remaining: int | None
    urgency: str # OVERDUE, EXPIRING_15_DAYS, EXPIRING_30_DAYS, COMPLIANT

class EnforcementCreate(BaseModel):
    instrument_id: str
    violation_type: str
    severity: str
    notes: str | None = None
    action_taken: str | None = None
    location: str | None = None
