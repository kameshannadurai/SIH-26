"""Baseline the pre-existing Legal Metrology schema.

The Supabase database already contains the tables registered in application
metadata.  This revision deliberately has no DDL: Alembic records it as the
safe migration starting point, rather than attempting to recreate or drop
existing production data. Subsequent changes must use explicit Alembic DDL.
"""
revision = "202608260001"
down_revision = None
branch_labels = None
depends_on = None
def upgrade():
    pass
def downgrade():
    # A baseline must never remove pre-existing tables.
    pass
