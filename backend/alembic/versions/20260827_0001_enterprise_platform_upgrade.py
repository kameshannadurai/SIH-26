"""enterprise platform upgrade

Revision ID: 202608270001
Revises: 202608260002
Create Date: 2026-08-27 00:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '202608270001'
down_revision = '202608260002'
branch_labels = None
depends_on = None

def upgrade():
    # Add columns to users for Indian state, district, and GPS coordinates
    op.add_column('users', sa.Column('state', sa.String(length=100), nullable=True))
    op.create_index('ix_users_state', 'users', ['state'], unique=False)
    op.add_column('users', sa.Column('district', sa.String(length=100), nullable=True))
    op.create_index('ix_users_district', 'users', ['district'], unique=False)
    op.add_column('users', sa.Column('latitude', sa.Float(), nullable=True))
    op.add_column('users', sa.Column('longitude', sa.Float(), nullable=True))

    # Add columns to verification_certificates for issuing officer and revocation
    op.add_column('verification_certificates', sa.Column('issuing_officer_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True))
    op.add_column('verification_certificates', sa.Column('revocation_reason', sa.Text(), nullable=True))
    op.add_column('verification_certificates', sa.Column('revoked_at', sa.DateTime(), nullable=True))
    op.add_column('verification_certificates', sa.Column('revoked_by_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True))

    # Add columns to verification_records for evidence metadata (capture timestamp, GPS, filename)
    op.add_column('verification_records', sa.Column('evidence_metadata', sa.JSON(), nullable=True))

def downgrade():
    op.drop_column('verification_records', 'evidence_metadata')
    op.drop_column('verification_certificates', 'revoked_by_id')
    op.drop_column('verification_certificates', 'revoked_at')
    op.drop_column('verification_certificates', 'revocation_reason')
    op.drop_column('verification_certificates', 'issuing_officer_id')
    op.drop_column('users', 'longitude')
    op.drop_column('users', 'latitude')
    op.drop_index('ix_users_district', table_name='users')
    op.drop_column('users', 'district')
    op.drop_index('ix_users_state', table_name='users')
    op.drop_column('users', 'state')
