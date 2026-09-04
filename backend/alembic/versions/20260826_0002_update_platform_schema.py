"""update platform schema

Revision ID: 202608260002
Revises: 202608260001
Create Date: 2026-08-26 23:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '202608260002'
down_revision = '202608260001'
branch_labels = None
depends_on = None

def upgrade():
    # add columns to users
    op.add_column('users', sa.Column('organization_name', sa.String(length=150), nullable=True))
    op.add_column('users', sa.Column('contact_number', sa.String(length=30), nullable=True))
    op.add_column('users', sa.Column('address', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('role_specific_info', sa.JSON(), nullable=True))

    # add columns to instruments
    op.add_column('instruments', sa.Column('last_verification_date', sa.Date(), nullable=True))
    op.add_column('instruments', sa.Column('installation_details', sa.Text(), nullable=True))

    # add columns to verification_records
    op.add_column('verification_records', sa.Column('evidence_paths', sa.JSON(), nullable=True))
    op.add_column('verification_records', sa.Column('standards_used', sa.Text(), nullable=True))
    op.add_column('verification_records', sa.Column('defects_found', sa.Text(), nullable=True))

def downgrade():
    op.drop_column('verification_records', 'defects_found')
    op.drop_column('verification_records', 'standards_used')
    op.drop_column('verification_records', 'evidence_paths')
    op.drop_column('instruments', 'installation_details')
    op.drop_column('instruments', 'last_verification_date')
    op.drop_column('users', 'role_specific_info')
    op.drop_column('users', 'address')
    op.drop_column('users', 'contact_number')
    op.drop_column('users', 'organization_name')
