import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base


class Tenant(Base):
    __tablename__ = "tenants"
    __table_args__ = {"schema": "concierge"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_name = Column(String, nullable=False)
    telegram_bot_token = Column(String, unique=True, nullable=False)
    pinecone_namespace = Column(String, nullable=True)
    litellm_virtual_key = Column(String, nullable=True)
    status = Column(String, nullable=False, default="active")
    plan = Column(String, nullable=False, default="starter")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    chatbot_config = Column(JSONB, nullable=True)


class Memory(Base):
    __tablename__ = "memories"
    __table_args__ = {"schema": "concierge"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("concierge.tenants.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, nullable=False, index=True)
    fact = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class TenantUser(Base):
    __tablename__ = "tenant_users"
    __table_args__ = {"schema": "concierge"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=True)
    google_sub = Column(String, unique=True, nullable=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("concierge.tenants.id", ondelete="SET NULL"), nullable=True)
    role = Column(String, nullable=False, default="tenant")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_login = Column(DateTime(timezone=True), nullable=True)
