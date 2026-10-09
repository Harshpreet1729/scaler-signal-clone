"""Add reactions without rebuilding or modifying existing message data.

Revision ID: 0002
Revises: 0001
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # sqlite3's legacy transaction mode does not begin on DDL. Ensure ALTER,
    # CREATE and Alembic's revision update roll back together on startup failure.
    connection = op.get_bind()
    if not connection.connection.driver_connection.in_transaction:
        connection.exec_driver_sql("BEGIN IMMEDIATE")
    op.add_column("messages", sa.Column("reaction_version", sa.Integer(), nullable=False, server_default="0"))
    op.create_table(
        "message_reactions",
        sa.Column("message_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("emoji", sa.String(8), nullable=False),
        sa.Column("conversation_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("message_id", "user_id", "emoji"),
        sa.ForeignKeyConstraint(["conversation_id", "message_id"], ["messages.conversation_id", "messages.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["conversation_id", "user_id"], ["conversation_members.conversation_id", "conversation_members.user_id"], ondelete="RESTRICT"),
        sa.CheckConstraint("emoji IN ('👍','❤️','😂','😮','😢','🙏')", name="ck_reactions_emoji"),
    )
    op.create_index("ix_reactions_member", "message_reactions", ["conversation_id", "user_id"])


def downgrade() -> None:
    # Rolling back application code is safe with this additive schema. Do not
    # discard reactions automatically or rebuild the populated messages table.
    raise RuntimeError("Keep additive revision 0002 for code rollback; schema rollback requires a reviewed backup restore.")
