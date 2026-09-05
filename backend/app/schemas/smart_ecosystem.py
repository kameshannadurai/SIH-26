from __future__ import annotations

from datetime import date, datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field


# ==============================================================================
# OTP & CITIZEN AUTH SCHEMAS
# ==============================================================================

class OTPSendRequest(BaseModel):
    phone_number: str = Field(min_length=10, max_length=15)
    email: str = Field(min_length=5, max_length=150)
    citizen_name: str | None = None


class OTPSendResponse(BaseModel):
    success: bool
    message: str
    phone_number: str
    email: str
    verification_token: str
    expires_in_seconds: int = 300
    cooldown_seconds: int = 60


class OTPVerifyRequest(BaseModel):
    verification_token: str
    otp_code: str = Field(min_length=6, max_length=6)


class OTPVerifyResponse(BaseModel):
    success: bool
    message: str
    phone_number: str
    email: str | None = None
    is_verified: bool
    verified_token: str
    verified_at: str | None = None


# ==============================================================================
# CITIZEN COMPLAINT SCHEMAS
# ==============================================================================

class ComplaintCreate(BaseModel):
    citizen_name: str = Field(min_length=2, max_length=150)
    id_reference: str | None = Field(default=None, max_length=100)  # Masked Aadhaar / ID (e.g. XXXX-XXXX-1234)
    verified_phone: str = Field(min_length=10, max_length=30)
    verified_email: str | None = Field(default=None, max_length=150)
    verification_token: str
    shop_name: str = Field(min_length=2, max_length=200)
    shop_address: str | None = None
    state: str = Field(min_length=2, max_length=100)
    district: str = Field(min_length=2, max_length=100)
    latitude: float | None = None
    longitude: float | None = None
    instrument_id_str: str | None = None
    instrument_category: str | None = None
    complaint_category: str = "INCORRECT_WEIGHT"
    violation_type: str = Field(min_length=3, max_length=150)
    description: str = Field(min_length=10)
    severity: str = "MEDIUM"  # LOW, MEDIUM, HIGH, CRITICAL
    entry_method: str = "PORTAL"  # PORTAL or QR_SCAN
    qr_token_used: str | None = None


class ComplaintEvidenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    storage_path: str
    filename: str
    content_type: str
    evidence_type: str
    file_size: int | None = None
    latitude: float | None = None
    longitude: float | None = None
    uploaded_at: datetime


class ComplaintTimelineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    action: str
    actor_name: str | None = None
    actor_role: str | None = None
    notes: str | None = None
    old_status: str | None = None
    new_status: str | None = None
    created_at: datetime


class ComplaintOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    complaint_number: str
    citizen_name: str
    id_reference_token: str | None = None
    verified_phone: str
    verified_email: str | None = None
    shop_name: str
    shop_address: str | None = None
    state: str
    district: str
    latitude: float | None = None
    longitude: float | None = None
    instrument_id: int | None = None
    instrument_category: str | None = None
    complaint_category: str
    violation_type: str
    description: str
    severity: str
    status: str
    assigned_officer_id: int | None = None
    is_repeat_offender: bool
    risk_score: int
    resolution_notes: str | None = None
    action_taken: str | None = None
    entry_method: str
    created_at: datetime
    updated_at: datetime
    evidence: list[ComplaintEvidenceOut] = []
    timeline: list[ComplaintTimelineOut] = []


class ComplaintTrackOut(BaseModel):
    complaint_number: str
    shop_name: str
    district: str
    state: str
    violation_type: str
    severity: str
    status: str
    created_at: datetime
    resolution_notes: str | None = None
    action_taken: str | None = None
    timeline: list[ComplaintTimelineOut] = []


class ComplaintActionRequest(BaseModel):
    status: str = Field(description="ACTION_TAKEN, RESOLVED, DISMISSED, IN_INVESTIGATION")
    action_taken: str = Field(min_length=5)
    resolution_notes: str | None = None
    fine_amount: float | None = None
    seizure_made: bool = False


class ComplaintAssignRequest(BaseModel):
    officer_id: int
    notes: str | None = None


class ShopSearchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    shop_name: str
    registration_number: str | None = None
    owner_name: str | None = None
    address: str | None = None
    state: str
    district: str
    latitude: float | None = None
    longitude: float | None = None
    risk_score: int
    complaint_count: int
    is_flagged: bool


# ==============================================================================
# SCHEDULING SCHEMAS
# ==============================================================================

class OfficerAvailabilityCreate(BaseModel):
    day_of_week: int | None = None  # 0=Mon, 6=Sun
    start_time: str = "09:00"
    end_time: str = "17:00"
    slot_duration_minutes: int = 60
    max_daily_inspections: int = 8
    break_start: str | None = "13:00"
    break_end: str | None = "14:00"
    specific_date: date | None = None
    is_unavailable: bool = False
    location_jurisdiction: str | None = None


class OfficerAvailabilityOut(OfficerAvailabilityCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    officer_id: int
    is_active: bool
    created_at: datetime


class AvailableSlotOut(BaseModel):
    officer_id: int
    officer_name: str
    officer_role: str
    slot_date: date
    start_time: str
    end_time: str
    status: str
    is_available: bool


class SlotBookingRequest(BaseModel):
    application_number: str
    officer_id: int
    slot_date: date
    start_time: str
    end_time: str
    location: str | None = None
    notes: str | None = None


class SlotBookingResponse(BaseModel):
    success: bool
    slot_id: int
    application_number: str
    officer_name: str
    slot_date: date
    start_time: str
    end_time: str
    status: str
    message: str


class SlotRescheduleRequest(BaseModel):
    new_date: date
    new_start_time: str
    new_end_time: str
    reason: str | None = None


# ==============================================================================
# AI CHAT SCHEMAS
# ==============================================================================

class AIChatRequest(BaseModel):
    query: str = Field(min_length=1, max_length=1000)
    context_data: dict[str, Any] | None = None


class QuickAction(BaseModel):
    label: str
    path: str


class AIChatResponse(BaseModel):
    response: str
    role: str
    quick_actions: list[QuickAction] = []
    confidence: float = 0.95
    disclaimer: str = "This assistant is purely assistive. Official verification and legal determinations are made solely by authorized Legal Metrology Officers under the Legal Metrology Act, 2009."
