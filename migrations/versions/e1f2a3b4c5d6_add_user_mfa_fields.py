"""add user mfa fields

Revision ID: e1f2a3b4c5d6
Revises: d64dcb818e3b
Create Date: 2026-06-10
"""

from alembic import op
import sqlalchemy as sa


revision = "e1f2a3b4c5d6"
down_revision = "d64dcb818e3b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("mfa_enabled", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("users", sa.Column("mfa_totp_secret", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "mfa_totp_secret")
    op.drop_column("users", "mfa_enabled")
