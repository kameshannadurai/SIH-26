# Legal Metrology Digital Verification Platform (Government-Grade Smart Digital Ecosystem)

Enterprise digital verification and citizen governance platform for the complete online lifecycle of legal weighing and measuring instruments compliant with the **Legal Metrology Act, 2009** and the **Legal Metrology (Government Approved Test Centre) Amendment Rules, 2025**.

---

## 🌟 End-to-End Smart Ecosystem Workflow

1. **Business Registration & Geo-Tagging**:
   - Self-registration restricted to `BUSINESS` accounts.
   - Comprehensive Indian State dropdown (28 States & 8 UTs) with data-linked District dropdown.
   - Full address with optional one-click GPS coordinate autofill and location tagging.

2. **Instrument Registration (18 Sanctioned 2025 GATC Categories)**:
   - Dynamic Unit (kg, g, kN, mmHg, °C, m³, kWh, mm, km/h, etc.), Accuracy Class, and Capacity fields tailored to each category.
   - Dynamic fee estimation schedule.

3. **Intelligent 18-Category Automatic Routing (`route_verification_application`)**:
   - Automatically determines whether an instrument belongs to the 18 sanctioned GATC categories (`water_meter`, `sphygmomanometer`, `clinical_thermometer`, `automatic_rail_weighbridge`, `tape_measure`, `non_auto_weighing_class_3`, `non_auto_weighing_class_4`, `load_cell`, `beam_scale`, `counter_machine`, `weights_all`, `gas_meter`, `energy_meter`, `moisture_meter`, `speed_meter`, `breath_analyser`, `multi_dim_measuring`, `flow_meter`).
   - If GATC eligible: automatically routes to an accredited GATC centre verifier based on jurisdiction and availability.
   - If non-GATC: automatically routes to the regional Legal Metrology Officer (LMO) matching State & District jurisdiction without manual administrative bottleneck.
   - Administrative manual override mechanism with immutable audit logging.

4. **Smart Availability & Collision-Prevented Scheduling**:
   - LMO and GATC officers configure weekly working days, start/end times, slot duration (30/60 min), lunch breaks, and maximum daily inspection quotas.
   - Businesses view real-time open slots and reserve an appointment; atomic locking prevents double-booking.
   - Dispatches automated confirmation notifications to both applicant and officer.

5. **Field Verification & GPS Geofence Validation**:
   - On-site live GPS coordinate capture compared against registered establishment coordinates using Haversine geodesic calculation.
   - Flags geofence distance warnings without blocking inspection.
   - Working Reference Standards Used, defects found, observations checklist, and tolerance measurements recording.
   - Multiple evidence photo uploads securely stored with SHA-256 metadata and capture timestamps.

6. **Citizen Public Complaint & Redressal Portal**:
   - **Method A (QR-Scan Entry)**: Citizen scans physical instrument QR code; automatically pre-fills establishment, location, and instrument details into the complaint form.
   - **Method B (Direct Shop Search / Unlisted Reporting)**: Citizen searches registered shop directory or reports unlisted merchant.
   - Mobile OTP verification ensures citizen credibility without storing unnecessary raw identity data (compliant ID masking).
   - Instant generation of official Complaint ID (`COMP-{STATE}-{YEAR}-{SEQ}`) and automated dispatch to regional LMO and Admin.
   - Multi-factor risk scoring and automated **Repeat Offender** flagging.
   - Public live status tracking via Complaint ID and phone number.

7. **Local Role-Based AI Assistants (100% Offline / Local Intelligence)**:
   - **Business Copilot**: Application tracking, renewal milestones, GATC 2025 fee calculator, packaging compliance rules.
   - **LMO Assistant**: MPE (Maximum Permissible Error) tolerance tables, today's schedule agenda, pending citizen complaints, search/seizure rules.
   - **GATC Assistant**: 18-category testing procedures, calibration standards, accuracy class verification checklists.
   - **Admin Copilot**: District complaint heatmaps, officer workload analytics, high-risk establishment alerts, governance oversight.

8. **Tamper-Evident Certificate & Public QR Verification**:
   - Automatic SHA-256 cryptographic digest calculation.
   - High-entropy URL-safe `qr_token` (no numeric database IDs exposed).
   - Printable official Government of India Legal Metrology Certificate layout (A4 formatted).
   - Public verification endpoint `GET /public/verify/{qr_token}` (no authentication required).
   - Administrative revocation mechanism (`POST /certificates/{certificate_number}/revoke`) with official reason recorded.

9. **Offline-First Flutter LMO Mobile App**:
   - Searchable assigned inspections, smart appointment agenda, and citizen complaints list.
   - Field verification workbench with camera/gallery multi-photo capture and GPS attachment.
   - Offline draft queueing with one-tap auto-sync upon network reconnection.

---

## 🏛 18 GATC 2025 Amendment Verifiable Categories

| Category ID | Instrument Name | Units | Applicable Accuracy Classes / Range |
| :--- | :--- | :--- | :--- |
| `water_meter` | Water Meter | m³, kL, L, gal | Domestic, Commercial, Industrial |
| `sphygmomanometer` | Sphygmomanometer | mmHg, kPa | Medical Grade Class II (0-300 mmHg) |
| `clinical_thermometer` | Clinical Thermometer | °C, °F | Class 1 (32-42 °C) |
| `automatic_rail_weighbridge` | Automatic Rail Weighbridge | t, tonne, kg | Class 0.2, 0.5, 1, 2 |
| `tape_measure` | Tape Measure | m, cm, mm, ft | Class I, Class II, Class III |
| `non_auto_weighing_class_3` | Non-Automatic Weighing Class III | kg, g | Medium Accuracy Class III (up to 150 kg) |
| `non_auto_weighing_class_4` | Non-Automatic Weighing Class IIII | kg, t | Ordinary Accuracy Class IIII |
| `load_cell` | Load Cell | kN, N, kgf, t | Class A, B, C, D (up to 100 kN+) |
| `beam_scale` | Beam Scale | kg, g | Class B, C, D (up to 50 kg) |
| `counter_machine` | Counter Machine | kg, g | Commercial Class III (up to 50 kg) |
| `weights_all` | Weights of All Category | kg, g, mg | OIML E1, E2, F1, F2, M1, M2 |
| `gas_meter` | Gas Meter | m³/h, cfm, L/min | Domestic, Commercial, Industrial |
| `energy_meter` | Energy Meter | kWh, MWh, kVAh | Class 0.2S, 0.5S, 1.0, 2.0 |
| `moisture_meter` | Moisture Meter | % moisture | Standard Grade (0-40%) |
| `speed_meter` | Speed Meter for Vehicles | km/h, mph | Grade A ±1 km/h (0-250 km/h) |
| `breath_analyser` | Breath Analyser | mg/100ml, % BAC | Evidential Grade (0-400 mg%) |
| `multi_dim_measuring` | Multi-Dimensional Measuring Instrument | mm, cm, m | Automated Package Cubing / Laser |
| `flow_meter` | Flow Meter | L/min, m³/h, mm | Pipeline Volume/Mass Flow (15-300mm) |

---

## 📊 Implementation Status Discipline

| Module / Feature | Implementation Status | Description |
| :--- | :--- | :--- |
| **18-Category GATC Smart Routing** | `IMPLEMENTED` | `route_verification_application` service automatically routes to GATC or regional LMO |
| **Smart Officer Scheduling & Booking** | `IMPLEMENTED` | Availability manager, slot generator, collision check, double-booking prevention |
| **Public Citizen Complaint Portal** | `IMPLEMENTED` | QR scan autofill, shop search, OTP mobile verification, GPS capture, tracking |
| **Local Role AI Assistants** | `IMPLEMENTED` | Local offline intelligence for Business, LMO, GATC, and Admin with RBAC |
| **Geographic Heatmap & Risk Matrix** | `IMPLEMENTED` | Real-time district clustering, repeat offender detection, multi-factor risk score |
| **GPS Geofencing Validation** | `IMPLEMENTED` | Haversine geodesic validation comparing verification site with registered coords |
| **Digital Certificate + SHA-256 QR** | `IMPLEMENTED` | Cryptographic certificate generation, A4 printable layout, public verification |
| **Flutter Mobile Client** | `IMPLEMENTED` | Field inspections, offline drafts queue, complaints view, smart schedule agenda |
| **Multi-State IoT Device Telemetry** | `FUTURE` | Continuous direct hardware-scale MQTT streaming and IoT tamper sensor mesh |

---

## 🚀 Quickstart & Setup

### 1. Backend Setup (FastAPI + SQLAlchemy + Alembic)

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1

pip install -r requirements.txt

# Run additive migrations
alembic upgrade head

# Start API Server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Swagger API documentation available at `http://127.0.0.1:8000/docs`.

### 2. Web Frontend Setup (React + Vite)

```powershell
cd web
npm install
npm run dev
```

Web platform is available at `http://localhost:5173`.

### 3. Mobile Client Setup (Flutter)

```powershell
cd mobile
flutter pub get
flutter run
```

