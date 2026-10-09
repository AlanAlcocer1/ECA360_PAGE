"""Add rating (1-5) to comments.

Revision ID: 004_comment_rating
Revises: 003_public_site_url
Create Date: 2026-10-09
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004_comment_rating"
down_revision: Union[str, None] = "003_public_site_url"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "comments",
        sa.Column("rating", sa.Integer(), nullable=False, server_default="5"),
    )


def downgrade() -> None:
    op.drop_column("comments", "rating")
