import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
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


class Memory(Base):
    __tablename__ = "memories"
    __table_args__ = {"schema": "concierge"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("concierge.tenants.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, nullable=False, index=True)
    fact = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
