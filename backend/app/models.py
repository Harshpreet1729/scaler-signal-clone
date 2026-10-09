"""Relational records. Feature behavior for chats comes in later phases."""

from sqlalchemy import CheckConstraint, ForeignKey, ForeignKeyConstraint, Index, Integer, String, UniqueConstraint, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

AVATAR_KEYS = ("sky", "fern", "sun", "clay")


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(32), unique=True)
    display_name: Mapped[str] = mapped_column(String(80))
    avatar_key: Mapped[str] = mapped_column(String(16))
    created_at: Mapped[int] = mapped_column(Integer)
    __table_args__ = (
        CheckConstraint("length(username) BETWEEN 3 AND 32 AND username NOT GLOB '*[^a-z0-9_]*'", name="ck_users_username"),
        CheckConstraint("length(trim(display_name)) BETWEEN 1 AND 80", name="ck_users_display_name"),
        CheckConstraint("avatar_key IN ('sky','fern','sun','clay')", name="ck_users_avatar"),
    )


class AuthChallenge(Base):
    __tablename__ = "auth_challenges"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    username: Mapped[str] = mapped_column(String(32))
    purpose: Mapped[str] = mapped_column(String(8))
    expires_at: Mapped[int] = mapped_column(Integer)
    attempts: Mapped[int] = mapped_column(default=0, server_default="0")
    consumed_at: Mapped[int | None] = mapped_column(Integer)
    __table_args__ = (
        CheckConstraint("purpose IN ('register','login')", name="ck_challenges_purpose"),
        CheckConstraint("attempts BETWEEN 0 AND 5", name="ck_challenges_attempts"),
        CheckConstraint("length(username) BETWEEN 3 AND 32 AND username NOT GLOB '*[^a-z0-9_]*'", name="ck_challenges_username"),
        Index("ix_challenges_expires", "expires_at"),
    )


class AuthSession(Base):
    __tablename__ = "sessions"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    csrf_token: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[int] = mapped_column(Integer)
    expires_at: Mapped[int] = mapped_column(Integer)
    revoked_at: Mapped[int | None] = mapped_column(Integer)
    __table_args__ = (
        CheckConstraint("length(token_hash) = 64", name="ck_sessions_hash"),
        CheckConstraint("expires_at > created_at", name="ck_sessions_expiry"),
        Index("ix_sessions_user_revoked", "user_id", "revoked_at"),
        Index("ix_sessions_expires", "expires_at"),
    )


class Contact(Base):
    __tablename__ = "contacts"
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), primary_key=True)
    contact_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), primary_key=True)
    created_at: Mapped[int] = mapped_column(Integer)
    __table_args__ = (CheckConstraint("owner_id != contact_user_id", name="ck_contacts_nonself"), Index("ix_contacts_reverse", "contact_user_id"))


class Conversation(Base):
    __tablename__ = "conversations"
    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(6))
    name: Mapped[str | None] = mapped_column(String(100))
    direct_low_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    direct_high_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    created_at: Mapped[int] = mapped_column(Integer)
    last_activity_at: Mapped[int] = mapped_column(Integer)
    version: Mapped[int] = mapped_column(default=1, server_default="1")
    __table_args__ = (
        CheckConstraint("(kind = 'direct' AND name IS NULL AND direct_low_user_id IS NOT NULL AND direct_high_user_id IS NOT NULL AND direct_low_user_id < direct_high_user_id) OR (kind = 'group' AND direct_low_user_id IS NULL AND direct_high_user_id IS NULL AND name IS NOT NULL AND length(trim(name)) BETWEEN 1 AND 100)", name="ck_conversations_kind_pair"),
        CheckConstraint("version >= 1", name="ck_conversations_version"),
        UniqueConstraint("direct_low_user_id", "direct_high_user_id", name="uq_conversations_direct_pair"),
    )


Index("ix_conversations_activity", Conversation.last_activity_at.desc(), Conversation.id.desc())


class ConversationMember(Base):
    __tablename__ = "conversation_members"
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id", ondelete="RESTRICT"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), primary_key=True)
    role: Mapped[str] = mapped_column(String(6))
    joined_at: Mapped[int] = mapped_column(Integer)
    removed_at: Mapped[int | None] = mapped_column(Integer)
    __table_args__ = (
        CheckConstraint("role IN ('admin','member')", name="ck_members_role"),
        CheckConstraint("removed_at IS NULL OR removed_at >= joined_at", name="ck_members_removed"),
        Index("ix_members_user_active", "user_id", "removed_at", "conversation_id"),
        Index("ix_members_conversation_role", "conversation_id", "removed_at", "role"),
    )


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(Integer)
    sender_id: Mapped[int] = mapped_column(Integer)
    client_message_id: Mapped[str] = mapped_column(String(36))
    body: Mapped[str] = mapped_column(String(4000))
    created_at: Mapped[int] = mapped_column(Integer)
    reaction_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    __table_args__ = (
        ForeignKeyConstraint(["conversation_id", "sender_id"], ["conversation_members.conversation_id", "conversation_members.user_id"], ondelete="RESTRICT"),
        UniqueConstraint("sender_id", "client_message_id", name="uq_messages_sender_client"),
        UniqueConstraint("conversation_id", "id", name="uq_messages_conversation_id"),
        CheckConstraint("length(trim(body)) BETWEEN 1 AND 4000", name="ck_messages_body"),
        CheckConstraint("length(client_message_id) = 36 AND substr(client_message_id,9,1) = '-' AND substr(client_message_id,14,1) = '-' AND substr(client_message_id,19,1) = '-' AND substr(client_message_id,24,1) = '-' AND length(replace(client_message_id,'-','')) = 32 AND replace(client_message_id,'-','') NOT GLOB '*[^0-9a-f]*'", name="ck_messages_uuid"),
        {"sqlite_autoincrement": True},
    )


Index("ix_messages_history", Message.conversation_id, Message.id.desc())


class MessageReaction(Base):
    __tablename__ = "message_reactions"
    message_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    emoji: Mapped[str] = mapped_column(String(8), primary_key=True)
    conversation_id: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[int] = mapped_column(Integer)
    __table_args__ = (
        ForeignKeyConstraint(["conversation_id", "message_id"], ["messages.conversation_id", "messages.id"], ondelete="RESTRICT"),
        ForeignKeyConstraint(["conversation_id", "user_id"], ["conversation_members.conversation_id", "conversation_members.user_id"], ondelete="RESTRICT"),
        CheckConstraint("emoji IN ('👍','❤️','😂','😮','😢','🙏')", name="ck_reactions_emoji"),
        Index("ix_reactions_member", "conversation_id", "user_id"),
    )


class MessageReceipt(Base):
    __tablename__ = "message_receipts"
    message_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    recipient_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    conversation_id: Mapped[int] = mapped_column(Integer)
    delivered_at: Mapped[int | None] = mapped_column(Integer)
    read_at: Mapped[int | None] = mapped_column(Integer)
    __table_args__ = (
        ForeignKeyConstraint(["conversation_id", "message_id"], ["messages.conversation_id", "messages.id"], ondelete="RESTRICT"),
        ForeignKeyConstraint(["conversation_id", "recipient_id"], ["conversation_members.conversation_id", "conversation_members.user_id"], ondelete="RESTRICT"),
        CheckConstraint("read_at IS NULL OR (delivered_at IS NOT NULL AND read_at >= delivered_at)", name="ck_receipts_read_delivery"),
        Index("ix_receipts_unread", "recipient_id", "conversation_id", "message_id", sqlite_where=text("read_at IS NULL")),
    )
