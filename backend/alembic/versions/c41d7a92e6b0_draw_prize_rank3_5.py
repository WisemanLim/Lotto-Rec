"""draws prize/winners rank 3~5

Revision ID: c41d7a92e6b0
Revises: 5b12a3e10f18
Create Date: 2026-09-21 10:00:00.000000

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "c41d7a92e6b0"
down_revision: str | None = "5b12a3e10f18"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_COLS = [f"{k}{i}" for i in (3, 4, 5) for k in ("prize", "winners")]


def upgrade() -> None:
    existing = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("draws")}
    with op.batch_alter_table("draws", schema=None) as batch_op:
        for c in _COLS:
            if c not in existing:
                batch_op.add_column(sa.Column(c, sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("draws", schema=None) as batch_op:
        for c in reversed(_COLS):
            batch_op.drop_column(c)
