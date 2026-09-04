"""Local Role-Based AI Assistant for Legal Metrology Smart Digital Ecosystem.

Provides contextual, offline domain intelligence and live system status for:
- BUSINESS AI: Application status, fee calculation, renewal deadlines, document guidance, packaging compliance.
- LMO AI: Verification tolerance limits, MPE tables, field inspection checklists, scheduled appointments, assigned complaints.
- GATC AI: 18-category testing protocols, laboratory calibration procedures, accuracy classes, assigned tests.
- ADMIN AI: Jurisdiction governance, complaint heatmaps, officer workload analytics, high-risk establishments, compliance overview.

Note: Purely assistive. Never makes binding enforcement decisions. Operates 100% locally.
"""
from __future__ import annotations

import re
from datetime import date, datetime, timedelta
from typing import Any
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models import (
    CitizenComplaint,
    EnforcementRecord,
    InspectionSlot,
    Instrument,
    Notification,
    ShopRegistry,
    User,
    VerificationApplication,
    VerificationAssignment,
    VerificationCertificate,
    VerificationRecord,
)

LEGAL_METROLOGY_KNOWLEDGE_BASE = {
    "act_2009": {
        "title": "The Legal Metrology Act, 2009 (Act No. 1 of 2010)",
        "summary": "An Act to establish and enforce standards of weights and measures, regulate trade and commerce in weights, measures and other goods which are sold or distributed by weight, measure or number.",
        "key_sections": {
            "Section 24": "Verification and stamping of weights or measures before use in transaction or protection.",
            "Section 30": "Penalty for using non-standard weight or measure (Fine up to ₹25,000 for first offence, imprisonment up to 6 months for second or subsequent).",
            "Section 33": "Penalty for non-compliance by Government Approved Test Centres.",
            "Section 36": "Penalty for selling, distributing pre-packaged commodities not conforming to standard declaration.",
            "Section 15": "Power of inspection, search, seizure of non-standard weights and measuring instruments by Legal Metrology Officers.",
        },
    },
    "gatc_rules_2025": {
        "title": "Legal Metrology (Government Approved Test Centre) Amendment Rules, 2025",
        "summary": "Establishes accredited testing centres for 18 notified categories of measuring instruments to expedite verification and ensure high precision testing.",
        "categories": [
            "Water Meter", "Sphygmomanometer", "Clinical Thermometer", "Automatic Rail Weighbridge",
            "Tape Measure", "Non-Automatic Weighing Class III", "Non-Automatic Weighing Class IIII",
            "Load Cell", "Beam Scale", "Counter Machine", "Weights of All Category", "Gas Meter",
            "Energy Meter", "Moisture Meter", "Speed Meter for Vehicles", "Breath Analyser",
            "Multi-Dimensional Measuring Instrument", "Flow Meter"
        ],
    },
    "mpe_tolerances": {
        "Class III (Medium Accuracy)": "±0.5e for 0-500e, ±1.0e for 501-2000e, ±1.5e for >2000e during initial verification. (Double for in-service inspection).",
        "Class IIII (Ordinary Accuracy)": "±0.5e for 0-50e, ±1.0e for 51-200e, ±1.5e for 201-1000e.",
        "Clinical Thermometers": "±0.1 °C between 35.5 °C and 42.0 °C.",
        "Sphygmomanometers": "±3 mmHg (±0.4 kPa) across 0-300 mmHg range.",
        "Water Meters": "±2% in upper flow zone (Qt to Qmax), ±5% in lower flow zone (Qmin to Qt).",
        "Speed Meters": "±1 km/h for speeds up to 100 km/h, ±1% for speeds above 100 km/h.",
    },
}


class LocalAIAssistant:
    def __init__(self, db: Session, user: User):
        self.db = db
        self.user = user
        self.role = user.role

    def answer_query(self, query: str) -> dict[str, Any]:
        """Parse query, retrieve context, and generate a structured role-appropriate response."""
        q = query.strip()
        q_lower = q.lower()

        # Route to role-specific handler
        if self.role == "BUSINESS":
            return self._handle_business_query(q, q_lower)
        elif self.role == "LMO":
            return self._handle_lmo_query(q, q_lower)
        elif self.role == "GATC":
            return self._handle_gatc_query(q, q_lower)
        elif self.role == "ADMIN":
            return self._handle_admin_query(q, q_lower)
        else:
            return self._handle_public_query(q, q_lower)

    # --------------------------------------------------------------------------
    # BUSINESS AI HANDLER
    # --------------------------------------------------------------------------
    def _handle_business_query(self, query: str, q_lower: str) -> dict[str, Any]:
        # 1. Application status query
        if any(w in q_lower for w in ["my application", "application status", "status of application", "pending application"]):
            apps = (
                self.db.query(VerificationApplication)
                .filter(VerificationApplication.applicant_id == self.user.id)
                .order_by(VerificationApplication.created_at.desc())
                .limit(5)
                .all()
            )
            if not apps:
                return {
                    "response": "You currently have no submitted verification applications. Would you like to register an instrument and apply for verification?",
                    "role": self.role,
                    "quick_actions": [{"label": "Register Instrument", "path": "/instruments"}, {"label": "New Application", "path": "/applications"}],
                    "confidence": 0.95,
                }
            items = []
            for a in apps:
                inst = self.db.get(Instrument, a.instrument_id)
                items.append(f"• **{a.application_number}** ({inst.instrument_type if inst else 'Instrument'}): Status is `{a.status}`. Created on {a.created_at.strftime('%d %b %Y')}.")
            return {
                "response": f"Here are your recent verification applications:\n\n" + "\n".join(items) + "\n\nYou can click on any application in the Applications tab to view full details or schedule an appointment slot.",
                "role": self.role,
                "quick_actions": [{"label": "View Applications", "path": "/applications"}],
                "confidence": 0.98,
            }

        # 2. Appointment / inspection query
        if any(w in q_lower for w in ["appointment", "inspection date", "when is my inspection", "schedule", "slot"]):
            slots = (
                self.db.query(InspectionSlot)
                .filter(InspectionSlot.booked_by_id == self.user.id, InspectionSlot.status == "BOOKED")
                .order_by(InspectionSlot.slot_date.asc())
                .all()
            )
            if slots:
                lines = [f"• **{s.slot_date.strftime('%d %b %Y')}** from {s.start_time} to {s.end_time} at {s.location or 'Registered Address'} (Status: `{s.status}`)." for s in slots]
                return {
                    "response": f"You have {len(slots)} confirmed verification appointment(s):\n\n" + "\n".join(lines) + "\n\nPlease ensure the instrument and working area are accessible.",
                    "role": self.role,
                    "quick_actions": [{"label": "View Schedule", "path": "/applications"}],
                    "confidence": 0.95,
                }
            return {
                "response": "You don't have any active booked inspection appointments. If your application has been assigned to an officer, you can pick an available slot directly in the Applications section.",
                "role": self.role,
                "quick_actions": [{"label": "Book Slot", "path": "/applications"}],
                "confidence": 0.92,
            }

        # 3. Certificate expiry query
        if any(w in q_lower for w in ["certificate", "expiry", "when does it expire", "valid until", "due"]):
            instruments = (
                self.db.query(Instrument)
                .filter(Instrument.owner_id == self.user.id)
                .order_by(Instrument.next_verification_due_date.asc().nullslast())
                .all()
            )
            if not instruments:
                return {
                    "response": "You do not have any registered instruments in the portal yet.",
                    "role": self.role,
                    "quick_actions": [{"label": "Register Instrument", "path": "/instruments"}],
                    "confidence": 0.95,
                }
            lines = []
            for inst in instruments[:5]:
                due_str = inst.next_verification_due_date.strftime('%d %b %Y') if inst.next_verification_due_date else "Not Scheduled"
                lines.append(f"• **{inst.instrument_id}** ({inst.instrument_type}, Serial: `{inst.serial_number}`): Verification Due on **{due_str}** (Status: `{inst.status}`).")
            return {
                "response": f"Here is the verification validity for your registered instruments:\n\n" + "\n".join(lines) + "\n\nInstruments due within 30 days should be submitted for renewal promptly to prevent non-compliance penalties under Section 24.",
                "role": self.role,
                "quick_actions": [{"label": "Due Tracking", "path": "/due-tracking"}, {"label": "Certificates", "path": "/certificates"}],
                "confidence": 0.97,
            }

        # 4. GATC rules and fee queries
        if any(w in q_lower for w in ["fee", "how much", "cost", "gatc", "rule", "penalty", "law", "act"]):
            return {
                "response": (
                    "**Legal Metrology & GATC 2025 Rule Guidelines:**\n\n"
                    "1. **Periodic Verification (Section 24)**: All commercial weighing and measuring instruments must be verified and stamped annually or biennially depending on state rules.\n"
                    "2. **GATC 18 Categories**: Instruments such as Water Meters, Blood Pressure Monitors, Weighbridges, Flow Meters, Non-Automatic Scales Class III/IIII, Load Cells, and Energy Meters can be verified at accredited Government Approved Test Centres.\n"
                    "3. **Fee Structure**: Fees are automatically calculated during application based on instrument category, accuracy class, capacity, or size.\n"
                    "4. **Penalties (Section 30)**: Using unverified or non-standard weights can attract fines up to ₹25,000 for a first offence."
                ),
                "role": self.role,
                "quick_actions": [{"label": "Estimate Fee & Register", "path": "/instruments"}],
                "confidence": 0.90,
            }

        # Default Business Assistant Response
        return {
            "response": (
                f"Hello {self.user.full_name}! As your Business Compliance Assistant, I can help you with:\n\n"
                "• Checking status of submitted verification applications\n"
                "• Viewing upcoming inspection slots and appointments\n"
                "• Tracking certificate due dates and renewals\n"
                "• Guidance on Legal Metrology Act 2009 and GATC 2025 rules\n\n"
                "How can I assist your business today?"
            ),
            "role": self.role,
            "quick_actions": [{"label": "My Applications", "path": "/applications"}, {"label": "My Instruments", "path": "/instruments"}, {"label": "Due Tracking", "path": "/due-tracking"}],
            "confidence": 0.85,
        }

    # --------------------------------------------------------------------------
    # LMO AI HANDLER
    # --------------------------------------------------------------------------
    def _handle_lmo_query(self, query: str, q_lower: str) -> dict[str, Any]:
        # 1. Scheduled inspections today / upcoming
        if any(w in q_lower for w in ["today", "scheduled", "appointment", "inspections today", "my schedule"]):
            today = date.today()
            slots = (
                self.db.query(InspectionSlot)
                .filter(InspectionSlot.officer_id == self.user.id, InspectionSlot.slot_date == today, InspectionSlot.status == "BOOKED")
                .all()
            )
            assigned_count = (
                self.db.query(VerificationAssignment)
                .filter(VerificationAssignment.assigned_officer_id == self.user.id, VerificationAssignment.status == "ASSIGNED")
                .count()
            )
            lines = [f"• **{s.start_time} - {s.end_time}**: Slot #{s.id} (Location: {s.location or 'Field Site'})" for s in slots]
            slot_summary = "\n".join(lines) if lines else "• No booked appointments scheduled specifically for today."
            return {
                "response": (
                    f"**Today's Field Schedule ({today.strftime('%d %b %Y')}):**\n\n"
                    f"{slot_summary}\n\n"
                    f"You have **{assigned_count}** pending verification assignments awaiting inspection in your jurisdiction ({self.user.district or 'All'}, {self.user.state or 'State'})."
                ),
                "role": self.role,
                "quick_actions": [{"label": "Assigned Inspections", "path": "/assignments"}, {"label": "Field Verification", "path": "/verify-field"}],
                "confidence": 0.98,
            }

        # 2. Assigned complaints
        if any(w in q_lower for w in ["complaint", "citizen complaint", "violation", "investigation"]):
            complaints = (
                self.db.query(CitizenComplaint)
                .filter(
                    or_(
                        CitizenComplaint.assigned_officer_id == self.user.id,
                        and_(func.lower(CitizenComplaint.district) == (self.user.district or "").lower(), CitizenComplaint.status.in_(["SUBMITTED", "ASSIGNED", "IN_INVESTIGATION"]))
                    )
                )
                .order_by(CitizenComplaint.created_at.desc())
                .limit(5)
                .all()
            )
            if not complaints:
                return {
                    "response": f"There are currently no open citizen complaints in your jurisdiction ({self.user.district}, {self.user.state}).",
                    "role": self.role,
                    "quick_actions": [{"label": "All Assignments", "path": "/assignments"}],
                    "confidence": 0.95,
                }
            items = []
            for c in complaints:
                repeat_badge = " [REPEAT OFFENDER]" if c.is_repeat_offender else ""
                items.append(f"• **{c.complaint_number}** ({c.shop_name}): `{c.violation_type}` | Severity: **{c.severity}** | Status: `{c.status}`{repeat_badge}")
            return {
                "response": f"Here are the active citizen complaints in your jurisdiction:\n\n" + "\n".join(items) + "\n\nPlease prioritize complaints flagged as High Risk or Repeat Offender.",
                "role": self.role,
                "quick_actions": [{"label": "View Field Work", "path": "/verify-field"}],
                "confidence": 0.96,
            }

        # 3. MPE and Tolerance limits
        if any(w in q_lower for w in ["tolerance", "mpe", "error limit", "class 3", "class 4", "maximum permissible error", "standard"]):
            return {
                "response": (
                    "**Maximum Permissible Errors (MPE) Reference Table:**\n\n"
                    "• **Class III Non-Automatic Weighing (Medium Accuracy)**:\n"
                    "  - 0 to 500e: `±0.5e` (Verification) | `±1.0e` (In-Service)\n"
                    "  - 501 to 2000e: `±1.0e` (Verification) | `±2.0e` (In-Service)\n"
                    "  - 2001 to 10000e: `±1.5e` (Verification) | `±3.0e` (In-Service)\n\n"
                    "• **Class IIII Non-Automatic Weighing (Ordinary Accuracy)**:\n"
                    "  - 0 to 50e: `±0.5e` | 51 to 200e: `±1.0e` | 201 to 1000e: `±1.5e`\n\n"
                    "• **Clinical Thermometers**: `±0.1 °C` (35.5 - 42.0 °C)\n"
                    "• **Sphygmomanometers**: `±3 mmHg` (0 - 300 mmHg)\n"
                    "• **Water Meters**: `±2%` (Qt to Qmax) | `±5%` (Qmin to Qt)"
                ),
                "role": self.role,
                "quick_actions": [{"label": "Field Verification Form", "path": "/verify-field"}],
                "confidence": 0.98,
            }

        # Default LMO Assistant
        return {
            "response": (
                f"Officer {self.user.full_name}, I am your LMO Field Copilot. I can assist with:\n\n"
                "• Today's scheduled inspection agenda & appointments\n"
                "• Pending citizen complaints & repeat offender establishments\n"
                "• Maximum Permissible Error (MPE) tolerance calculation lookup\n"
                "• Standard enforcement procedures under Legal Metrology Act 2009"
            ),
            "role": self.role,
            "quick_actions": [{"label": "Assigned Inspections", "path": "/assignments"}, {"label": "Field Verification", "path": "/verify-field"}, {"label": "Certificates", "path": "/certificates"}],
            "confidence": 0.85,
        }

    # --------------------------------------------------------------------------
    # GATC AI HANDLER
    # --------------------------------------------------------------------------
    def _handle_gatc_query(self, query: str, q_lower: str) -> dict[str, Any]:
        # 1. Assigned GATC test work
        if any(w in q_lower for w in ["assigned", "tests", "pending", "instruments", "workload"]):
            assigned_count = (
                self.db.query(VerificationAssignment)
                .filter(VerificationAssignment.assigned_officer_id == self.user.id, VerificationAssignment.status.in_(["ASSIGNED", "IN_PROGRESS"]))
                .count()
            )
            recent = (
                self.db.query(VerificationAssignment)
                .filter(VerificationAssignment.assigned_officer_id == self.user.id)
                .order_by(VerificationAssignment.scheduled_at.desc())
                .limit(5)
                .all()
            )
            items = []
            for a in recent:
                app = self.db.get(VerificationApplication, a.application_id)
                inst = self.db.get(Instrument, app.instrument_id) if app else None
                items.append(f"• **{app.application_number if app else 'N/A'}** ({inst.instrument_type if inst else 'Instrument'}): Scheduled for {a.scheduled_at.strftime('%d %b %Y')}.")
            return {
                "response": (
                    f"**GATC Testing Workbench Status:**\n\n"
                    f"You have **{assigned_count}** assigned GATC test application(s) in progress.\n\n"
                    + ("\n".join(items) if items else "No pending tests in queue.")
                ),
                "role": self.role,
                "quick_actions": [{"label": "Assigned Tests", "path": "/assignments"}, {"label": "Record Test Results", "path": "/verify-field"}],
                "confidence": 0.95,
            }

        # 2. 18 Categories & Standards
        if any(w in q_lower for w in ["18 categories", "scope", "rule 2025", "calibration", "water meter", "weighbridge", "gas meter", "energy meter"]):
            return {
                "response": (
                    "**GATC 2025 Notified 18 Verifiable Categories:**\n\n"
                    "1. Water Meter | 2. Sphygmomanometer | 3. Clinical Thermometer\n"
                    "4. Automatic Rail Weighbridge | 5. Tape Measure | 6. Non-Auto Weighing Class III (≤150kg)\n"
                    "7. Non-Auto Weighing Class IIII | 8. Load Cell | 9. Beam Scale\n"
                    "10. Counter Machine | 11. Weights of All Category (E1-M2) | 12. Gas Meter\n"
                    "13. Energy Meter | 14. Moisture Meter | 15. Speed Meter for Vehicles\n"
                    "16. Breath Analyser | 17. Multi-Dimensional Measuring Instrument | 18. Flow Meter\n\n"
                    "Each verification must record Working Standards Used, Tolerance measurements, and issue a cryptographic SHA-256 certificate upon passing."
                ),
                "role": self.role,
                "quick_actions": [{"label": "View GATC Rules", "path": "/verify-field"}],
                "confidence": 0.98,
            }

        # Default GATC Response
        return {
            "response": (
                f"GATC Verifier {self.user.full_name}, I am your GATC Laboratory Copilot. I can assist with:\n\n"
                "• Assigned testing queue and instrument verification records\n"
                "• Approved 18-category testing criteria and calibration limits\n"
                "• Digital certificate generation & SHA-256 integrity rules\n"
                "• Working reference standards and observation recording"
            ),
            "role": self.role,
            "quick_actions": [{"label": "Assigned Tests", "path": "/assignments"}, {"label": "Record Test Verification", "path": "/verify-field"}],
            "confidence": 0.85,
        }

    # --------------------------------------------------------------------------
    # ADMIN AI HANDLER
    # --------------------------------------------------------------------------
    def _handle_admin_query(self, query: str, q_lower: str) -> dict[str, Any]:
        # 1. High risk establishments & repeat offenders
        if any(w in q_lower for w in ["high risk", "repeat offender", "risk", "critical", "violator"]):
            shops = (
                self.db.query(ShopRegistry)
                .filter(ShopRegistry.risk_score >= 50)
                .order_by(ShopRegistry.risk_score.desc())
                .limit(5)
                .all()
            )
            repeat_complaints = (
                self.db.query(CitizenComplaint)
                .filter(CitizenComplaint.is_repeat_offender == True)
                .order_by(CitizenComplaint.created_at.desc())
                .limit(5)
                .all()
            )
            lines = []
            for s in shops:
                lines.append(f"• **{s.shop_name}** ({s.district}, {s.state}): Risk Score **{s.risk_score}/100** ({s.complaint_count} complaints, {s.violation_count} violations).")
            for c in repeat_complaints:
                lines.append(f"• Complaint **{c.complaint_number}** ({c.shop_name} in {c.district}): Repeat complaint for `{c.violation_type}` (Score: {c.risk_score}).")
            
            summary = "\n".join(lines) if lines else "• No critical high-risk establishments detected at this time."
            return {
                "response": f"**High-Risk & Repeat Offender Intelligence:**\n\n{summary}\n\nYou can review district heatmaps and assign targeted enforcement teams from the Admin dashboard.",
                "role": self.role,
                "quick_actions": [{"label": "Assignments & Review", "path": "/assignments"}, {"label": "Due Tracking", "path": "/due-tracking"}],
                "confidence": 0.98,
            }

        # 2. System summary & statistics
        if any(w in q_lower for w in ["stats", "statistics", "how many", "summary", "overview", "total", "pending"]):
            total_apps = self.db.query(VerificationApplication).count()
            pending_apps = self.db.query(VerificationApplication).filter(VerificationApplication.status.in_(["SUBMITTED", "ASSIGNED", "IN_PROGRESS"])).count()
            total_certs = self.db.query(VerificationCertificate).filter(VerificationCertificate.status == "VALID").count()
            total_complaints = self.db.query(CitizenComplaint).count()
            pending_complaints = self.db.query(CitizenComplaint).filter(CitizenComplaint.status.in_(["SUBMITTED", "ASSIGNED", "IN_INVESTIGATION"])).count()
            active_lmo = self.db.query(User).filter(User.role == "LMO", User.is_active == True).count()
            active_gatc = self.db.query(User).filter(User.role == "GATC", User.is_active == True).count()

            return {
                "response": (
                    "**Platform-Wide Ecosystem Overview:**\n\n"
                    f"• **Applications**: Total `{total_apps}` | Pending Verification: `{pending_apps}`\n"
                    f"• **Active Digital Certificates**: `{total_certs}`\n"
                    f"• **Citizen Complaints**: Total `{total_complaints}` | Open / In-Investigation: `{pending_complaints}`\n"
                    f"• **Active Field Force**: `{active_lmo}` LMO Officers | `{active_gatc}` GATC Centres\n\n"
                    "Automated 18-category routing and smart scheduling are actively operating across all jurisdictions."
                ),
                "role": self.role,
                "quick_actions": [{"label": "Admin Dashboard", "path": "/dashboard"}, {"label": "Manage Assignments", "path": "/assignments"}],
                "confidence": 0.98,
            }

        # 3. Officer workload & bottlenecks
        if any(w in q_lower for w in ["officer workload", "workload", "bottleneck", "officers", "lmo load"]):
            officers = self.db.query(User).filter(User.role.in_(["LMO", "GATC"]), User.is_active == True).all()
            lines = []
            for off in officers[:8]:
                assigned = self.db.query(VerificationAssignment).filter(VerificationAssignment.assigned_officer_id == off.id, VerificationAssignment.status == "ASSIGNED").count()
                lines.append(f"• **{off.full_name}** ({off.role} - {off.district or 'All'}, {off.state or 'State'}): **{assigned}** pending assignments.")
            return {
                "response": "**Officer Workload Distribution:**\n\n" + "\n".join(lines) + "\n\nAdmin manual assignment override is available if load rebalancing is required.",
                "role": self.role,
                "quick_actions": [{"label": "Review Assignments", "path": "/assignments"}],
                "confidence": 0.95,
            }

        # Default Admin Response
        return {
            "response": (
                f"Administrator {self.user.full_name}, I am your Governance & Intelligence Copilot. I can assist with:\n\n"
                "• Platform statistics, application throughput, and certificate counts\n"
                "• High-risk establishment alerts and repeat offender flagging\n"
                "• Officer workload analysis across LMO and GATC jurisdictions\n"
                "• Automatic routing oversight and assignment override guidance"
            ),
            "role": self.role,
            "quick_actions": [{"label": "Admin Overview", "path": "/dashboard"}, {"label": "Assignments", "path": "/assignments"}, {"label": "Certificates", "path": "/certificates"}],
            "confidence": 0.85,
        }

    # --------------------------------------------------------------------------
    # PUBLIC CITIZEN QUERY (NO AUTH)
    # --------------------------------------------------------------------------
    def _handle_public_query(self, query: str, q_lower: str) -> dict[str, Any]:
        return {
            "response": (
                "Welcome to the e-Metrology Public Information Portal. You can verify weighing and measuring instrument certificates using their QR token, or file a citizen complaint regarding short-measure, inaccurate weights, or missing verification seals."
            ),
            "role": "PUBLIC",
            "quick_actions": [{"label": "File Complaint", "path": "/complaints"}, {"label": "Verify Certificate", "path": "/verify"}],
            "confidence": 0.90,
        }
