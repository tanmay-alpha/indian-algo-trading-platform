"""add scheduler fields to strategy_configs

Revision ID: b2e3f4a5c6d7
Revises: a9f1e2b3c4d5
Create Date: 2026-05-27 21:15:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "b2e3f4a5c6d7"
down_revision = "a9f1e2b3c4d5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("strategy_configs") as batch_op:
        batch_op.add_column(sa.Column("auto_paper_enabled", sa.Boolean(), nullable=False, server_default=sa.text("0")))
        batch_op.add_column(sa.Column("evaluation_interval_seconds", sa.Integer(), nullable=False, server_default="60"))
        batch_op.add_column(sa.Column("last_evaluated_at", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("next_evaluation_at", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("max_signals_per_day", sa.Integer(), nullable=False, server_default="10"))
        batch_op.add_column(sa.Column("cooldown_seconds", sa.Integer(), nullable=False, server_default="300"))


def downgrade() -> None:
    with op.batch_alter_table("strategy_configs") as batch_op:
        batch_op.drop_column("cooldown_seconds")
        batch_op.drop_column("max_signals_per_day")
        batch_op.drop_column("next_evaluation_at")
        batch_op.drop_column("last_evaluated_at")
        batch_op.drop_column("evaluation_interval_seconds")
        batch_op.drop_column("auto_paper_enabled")
