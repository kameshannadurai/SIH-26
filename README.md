# Legal Metrology Digital Verification Platform

SIH 26036 demo platform for the online verification lifecycle of weighing and measuring instruments.

## Implemented backend workflow

- JWT authentication with BUSINESS, LMO, GATC and ADMIN RBAC
- Public, non-sequential instrument IDs; owner-scoped instrument management and digital passports
- Draft/submit/cancel verification applications with guarded state transitions
- Admin scheduling with officer-role and overlap checks
- Field verification records, observations, measurements, GPS evidence, approval/rejection, and immutable audit events
- Approved verification creates a SHA-256 tamper-evident certificate, notification, and public verification response
- Notifications, enforcement records, risk scoring, dashboards, and a replaceable assistive AI/OCR interface

## Architecture

`backend/app` contains FastAPI routers, SQLAlchemy models, Pydantic validation schemas, and domain services. File storage and OCR/model inference are deliberately represented by adapters; production deployments should configure Supabase Storage/S3 and a YOLO/PaddleOCR implementation without changing legal workflow logic.

## Setup

Create `backend/.env` (never commit it):

```env
DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@HOST:5432/DATABASE
SECRET_KEY=long-random-secret
CORS_ORIGINS=http://localhost:5173
```

Install the runtime requirements, then the deployment/test extras:

```powershell
cd backend
./venv/Scripts/pip install -r requirements.production.txt
./venv/Scripts/alembic upgrade head
./venv/Scripts/uvicorn app.main:app --reload
```

Swagger is available at `http://localhost:8000/docs`; liveness at `/health`. The public QR target is `GET /public/verify/{certificate_number}`.

## Local SIH demo accounts

Public registration remains deliberately restricted: `POST /auth/register` only accepts the `BUSINESS` role and returns `403` for LMO, GATC, or ADMIN attempts.

For an explicitly local demonstration, seed the three officer accounts through the separate script below. The script is not an API endpoint, is not imported by FastAPI, requires an explicit opt-in flag, reads every credential from the process environment, and never overwrites an existing user.

```powershell
cd backend
$env:ENABLE_DEMO_SEED = 'true'
$env:DEMO_LMO_EMAIL = 'lmo@test.com'
$env:DEMO_GATC_EMAIL = 'gatc@test.com'
$env:DEMO_ADMIN_EMAIL = 'admin@test.com'
$env:DEMO_USER_PASSWORD = 'TestPassword123'
.\venv\Scripts\python.exe scripts\seed_demo_users.py
```

These values are for local SIH demonstration only. Do not set `ENABLE_DEMO_SEED` or these environment variables in a production deployment. The script uses the same bcrypt hashing implementation as the login system.

## Database migrations

Production startup never invokes `Base.metadata.create_all()`. Apply the versioned schema using:

```powershell
cd backend
alembic upgrade head
```

The initial revision is a safe baseline for the existing Supabase schema: it records the already-present tables in Alembic without dropping or recreating them. Future schema changes must be explicit Alembic revisions.

## Deployment

`docker-compose.yml` builds the backend; provide production environment variables through the deployment platform’s secret store. The Docker entrypoint runs migrations before Uvicorn starts.

## Current scope / next integrations

The API and domain foundation are ready for the React/Tailwind dashboard and Flutter offline client. Those clients should use the documented REST API, local encrypted SQLite/Drift queueing for offline field submissions, secure object storage for uploads, and a real OCR/detection adapter. AI output is assistive only and must be confirmed by an authorized officer.
