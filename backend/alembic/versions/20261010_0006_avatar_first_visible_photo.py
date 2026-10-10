"""avatar is the first visible photo

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-10 11:30:00

Data only: before this revision the avatar was always the position-0 photo, even when that photo was hidden. The API
now keeps the avatar on the first visible photo; this recomputes it for existing profiles. The previous values are
not kept, so the downgrade leaves the corrected avatars in place.
"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0006"
down_revision: str | Sequence[str] | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE profiles p
        SET avatar_url = (
            SELECT i.url FROM profile_images i
            WHERE i.profile_id = p.id AND i.is_visible IS NOT FALSE
            ORDER BY i.position, i.created_at
            LIMIT 1
        )
        WHERE p.avatar_url IS DISTINCT FROM (
            SELECT i.url FROM profile_images i
            WHERE i.profile_id = p.id AND i.is_visible IS NOT FALSE
            ORDER BY i.position, i.created_at
            LIMIT 1
        )
        """
    )


def downgrade() -> None:
    pass
