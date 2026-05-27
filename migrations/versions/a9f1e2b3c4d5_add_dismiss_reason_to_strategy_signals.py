"""add dismiss_reason to strategy_signals

Revision ID: a9f1e2b3c4d5
Revises: c18d2ca198fd
Create Date: 2026-05-27 15:20:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "a9f1e2b3c4d5"
down_revision = "c18d2ca198fd"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("strategy_signals") as batch_op:
        batch_op.add_column(sa.Column("dismiss_reason", sa.String(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("strategy_signals") as batch_op:
        batch_op.drop_column("dismiss_reason")
