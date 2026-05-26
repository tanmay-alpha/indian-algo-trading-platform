"""Initial schema

Revision ID: 40478e2b5418
Revises: 
Create Date: 2026-05-26 12:17:01.649464

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '40478e2b5418'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. audit_logs
    op.create_table('audit_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('details', sa.String(), nullable=True),
        sa.Column('ip_address', sa.String(), nullable=True),
        sa.Column('created_at', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # 2. instruments
    op.create_table('instruments',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('token', sa.String(), nullable=False),
        sa.Column('symbol', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('expiry', sa.String(), nullable=True),
        sa.Column('strike', sa.Float(), nullable=True),
        sa.Column('lotsize', sa.Integer(), nullable=True),
        sa.Column('instrumenttype', sa.String(), nullable=True),
        sa.Column('exch_seg', sa.String(), nullable=True),
        sa.Column('tick_size', sa.Float(), nullable=True),
        sa.Column('created_at', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_instruments_symbol'), 'instruments', ['symbol'], unique=False)
    op.create_index(op.f('ix_instruments_token'), 'instruments', ['token'], unique=True)
    
    # 3. watchlists
    op.create_table('watchlists',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('created_at', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_watchlists_name'), 'watchlists', ['name'], unique=True)
    
    # 4. watchlist_items
    op.create_table('watchlist_items',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('watchlist_id', sa.Integer(), nullable=False),
        sa.Column('token', sa.String(), nullable=False),
        sa.Column('symbol', sa.String(), nullable=False),
        sa.Column('exch_seg', sa.String(), nullable=True),
        sa.Column('created_at', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['watchlist_id'], ['watchlists.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 5. order_requests
    op.create_table('order_requests',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('request_id', sa.String(), nullable=False),
        sa.Column('client_order_id', sa.String(), nullable=True),
        sa.Column('idempotency_key', sa.String(), nullable=True),
        sa.Column('symbol', sa.String(), nullable=True),
        sa.Column('side', sa.String(), nullable=True),
        sa.Column('quantity', sa.Integer(), nullable=True),
        sa.Column('order_type', sa.String(), nullable=True),
        sa.Column('mode', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('broker_order_id', sa.String(), nullable=True),
        sa.Column('reject_reason', sa.String(), nullable=True),
        sa.Column('avg_fill_price', sa.Float(), nullable=True),
        sa.Column('created_at', sa.String(), nullable=True),
        sa.Column('updated_at', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_order_requests_idempotency_key'), 'order_requests', ['idempotency_key'], unique=True)
    op.create_index(op.f('ix_order_requests_request_id'), 'order_requests', ['request_id'], unique=True)

    # 6. order_events
    op.create_table('order_events',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('request_id', sa.String(), nullable=True),
        sa.Column('event_type', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('reason', sa.String(), nullable=True),
        sa.Column('broker_order_id', sa.String(), nullable=True),
        sa.Column('created_at', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # 7. order_fills
    op.create_table('order_fills',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('fill_id', sa.String(), nullable=False),
        sa.Column('request_id', sa.String(), nullable=False),
        sa.Column('broker_order_id', sa.String(), nullable=True),
        sa.Column('symbol', sa.String(), nullable=False),
        sa.Column('side', sa.String(), nullable=False),
        sa.Column('filled_quantity', sa.Integer(), nullable=False),
        sa.Column('fill_price', sa.Float(), nullable=False),
        sa.Column('fees', sa.Float(), server_default='0.0', nullable=True),
        sa.Column('source', sa.String(), server_default='paper', nullable=True),
        sa.Column('created_at', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_order_fills_fill_id'), 'order_fills', ['fill_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_order_fills_fill_id'), table_name='order_fills')
    op.drop_table('order_fills')
    op.drop_table('order_events')
    op.drop_index(op.f('ix_order_requests_request_id'), table_name='order_requests')
    op.drop_index(op.f('ix_order_requests_idempotency_key'), table_name='order_requests')
    op.drop_table('order_requests')
    op.drop_table('watchlist_items')
    op.drop_index(op.f('ix_watchlists_name'), table_name='watchlists')
    op.drop_table('watchlists')
    op.drop_index(op.f('ix_instruments_token'), table_name='instruments')
    op.drop_index(op.f('ix_instruments_symbol'), table_name='instruments')
    op.drop_table('instruments')
    op.drop_table('audit_logs')
