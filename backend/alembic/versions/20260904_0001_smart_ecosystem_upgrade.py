"""smart ecosystem upgrade

Revision ID: 202609040001
Revises: 202608270001
Create Date: 2026-09-04 15:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '202609040001'
down_revision = '202608270001'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Officer Availability
    op.create_table(
        'officer_availability',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('officer_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('day_of_week', sa.Integer(), nullable=True),
        sa.Column('start_time', sa.String(length=10), default='09:00', nullable=False),
        sa.Column('end_time', sa.String(length=10), default='17:00', nullable=False),
        sa.Column('slot_duration_minutes', sa.Integer(), default=60, nullable=False),
        sa.Column('max_daily_inspections', sa.Integer(), default=8, nullable=False),
        sa.Column('break_start', sa.String(length=10), default='13:00', nullable=True),
        sa.Column('break_end', sa.String(length=10), default='14:00', nullable=True),
        sa.Column('specific_date', sa.Date(), nullable=True),
        sa.Column('is_unavailable', sa.Boolean(), default=False, nullable=False),
        sa.Column('location_jurisdiction', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_officer_availability_officer_id', 'officer_availability', ['officer_id'])
    op.create_index('ix_officer_availability_specific_date', 'officer_availability', ['specific_date'])

    # 2. Inspection Slots
    op.create_table(
        'inspection_slots',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('officer_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('application_id', sa.Integer(), sa.ForeignKey('verification_applications.id'), nullable=True),
        sa.Column('booked_by_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('slot_date', sa.Date(), nullable=False),
        sa.Column('start_time', sa.String(length=10), nullable=False),
        sa.Column('end_time', sa.String(length=10), nullable=False),
        sa.Column('status', sa.String(length=20), default='AVAILABLE', nullable=False),
        sa.Column('lock_expires_at', sa.DateTime(), nullable=True),
        sa.Column('location', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_inspection_slots_officer_id', 'inspection_slots', ['officer_id'])
    op.create_index('ix_inspection_slots_slot_date', 'inspection_slots', ['slot_date'])
    op.create_index('ix_inspection_slots_status', 'inspection_slots', ['status'])

    # 3. OTP Verification
    op.create_table(
        'otp_verifications',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('phone_number', sa.String(length=30), nullable=False),
        sa.Column('email', sa.String(length=150), nullable=True),
        sa.Column('otp_code', sa.String(length=128), nullable=False),
        sa.Column('verification_token', sa.String(length=64), unique=True, nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('is_verified', sa.Boolean(), default=False, nullable=False),
        sa.Column('is_used', sa.Boolean(), default=False, nullable=False),
        sa.Column('attempts_count', sa.Integer(), default=0, nullable=False),
        sa.Column('resend_count', sa.Integer(), default=0, nullable=False),
        sa.Column('last_sent_at', sa.DateTime(), nullable=False),
        sa.Column('verified_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_otp_verifications_phone_number', 'otp_verifications', ['phone_number'])
    op.create_index('ix_otp_verifications_email', 'otp_verifications', ['email'])
    op.create_index('ix_otp_verifications_token', 'otp_verifications', ['verification_token'])

    # 4. Shop Registry
    op.create_table(
        'shop_registry',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('shop_name', sa.String(length=200), nullable=False),
        sa.Column('registration_number', sa.String(length=100), unique=True, nullable=True),
        sa.Column('owner_name', sa.String(length=150), nullable=True),
        sa.Column('contact_number', sa.String(length=30), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('state', sa.String(length=100), nullable=False),
        sa.Column('district', sa.String(length=100), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('risk_score', sa.Integer(), default=10, nullable=False),
        sa.Column('complaint_count', sa.Integer(), default=0, nullable=False),
        sa.Column('violation_count', sa.Integer(), default=0, nullable=False),
        sa.Column('last_inspection_date', sa.Date(), nullable=True),
        sa.Column('is_flagged', sa.Boolean(), default=False, nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_shop_registry_shop_name', 'shop_registry', ['shop_name'])
    op.create_index('ix_shop_registry_state', 'shop_registry', ['state'])
    op.create_index('ix_shop_registry_district', 'shop_registry', ['district'])
    op.create_index('ix_shop_registry_risk_score', 'shop_registry', ['risk_score'])

    # 5. Citizen Complaints
    op.create_table(
        'citizen_complaints',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('complaint_number', sa.String(length=50), unique=True, nullable=False),
        sa.Column('citizen_name', sa.String(length=150), nullable=False),
        sa.Column('id_reference_token', sa.String(length=100), nullable=True),
        sa.Column('verified_phone', sa.String(length=30), nullable=False),
        sa.Column('verified_email', sa.String(length=150), nullable=True),
        sa.Column('shop_name', sa.String(length=200), nullable=False),
        sa.Column('shop_address', sa.Text(), nullable=True),
        sa.Column('state', sa.String(length=100), nullable=False),
        sa.Column('district', sa.String(length=100), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('instrument_id', sa.Integer(), sa.ForeignKey('instruments.id'), nullable=True),
        sa.Column('instrument_category', sa.String(length=100), nullable=True),
        sa.Column('complaint_category', sa.String(length=100), default='INCORRECT_WEIGHT', nullable=False),
        sa.Column('violation_type', sa.String(length=150), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('severity', sa.String(length=20), default='MEDIUM', nullable=False),
        sa.Column('status', sa.String(length=30), default='SUBMITTED', nullable=False),
        sa.Column('assigned_officer_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('is_repeat_offender', sa.Boolean(), default=False, nullable=False),
        sa.Column('risk_score', sa.Integer(), default=20, nullable=False),
        sa.Column('resolution_notes', sa.Text(), nullable=True),
        sa.Column('action_taken', sa.Text(), nullable=True),
        sa.Column('entry_method', sa.String(length=20), default='PORTAL', nullable=False),
        sa.Column('qr_token_used', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_citizen_complaints_complaint_number', 'citizen_complaints', ['complaint_number'])
    op.create_index('ix_citizen_complaints_verified_phone', 'citizen_complaints', ['verified_phone'])
    op.create_index('ix_citizen_complaints_shop_name', 'citizen_complaints', ['shop_name'])
    op.create_index('ix_citizen_complaints_state', 'citizen_complaints', ['state'])
    op.create_index('ix_citizen_complaints_district', 'citizen_complaints', ['district'])
    op.create_index('ix_citizen_complaints_status', 'citizen_complaints', ['status'])

    # 6. Complaint Evidence
    op.create_table(
        'complaint_evidence',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('complaint_id', sa.Integer(), sa.ForeignKey('citizen_complaints.id'), nullable=False),
        sa.Column('storage_path', sa.String(length=500), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('content_type', sa.String(length=100), nullable=False),
        sa.Column('evidence_type', sa.String(length=50), default='PHOTO', nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('uploaded_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_complaint_evidence_complaint_id', 'complaint_evidence', ['complaint_id'])

    # 7. Complaint Timelines
    op.create_table(
        'complaint_timelines',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('complaint_id', sa.Integer(), sa.ForeignKey('citizen_complaints.id'), nullable=False),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('actor_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('actor_name', sa.String(length=150), nullable=True),
        sa.Column('actor_role', sa.String(length=50), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('old_status', sa.String(length=30), nullable=True),
        sa.Column('new_status', sa.String(length=30), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_complaint_timelines_complaint_id', 'complaint_timelines', ['complaint_id'])


def downgrade():
    op.drop_table('complaint_timelines')
    op.drop_table('complaint_evidence')
    op.drop_table('citizen_complaints')
    op.drop_table('shop_registry')
    op.drop_table('otp_verifications')
    op.drop_table('inspection_slots')
    op.drop_table('officer_availability')
