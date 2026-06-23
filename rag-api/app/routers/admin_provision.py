import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.database import SessionLocal
from app.litellm_admin_service import generate_key
from app.models import Tenant

router = APIRouter(prefix="/api/admin")


class ProvisionRequest(BaseModel):
    companyName: str
    telegramBotToken: str
    plan: str = "starter"


class ProvisionResponse(BaseModel):
    tenantId: str
    companyName: str
    pineconeNamespace: str
    litellmVirtualKey: str
    botToken: str
    status: str
    plan: str


def _make_namespace(company: str) -> str:
    slug = company.lower().replace(" ", "_").replace("-", "_")
    short = uuid.uuid4().hex[:8]
    return f"{slug}_{short}"


@router.post("/provision", response_model=ProvisionResponse)
def provision(body: ProvisionRequest):
    db = SessionLocal()
    try:
        existing = db.query(Tenant).filter(
            Tenant.telegram_bot_token == body.telegramBotToken
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail="A tenant with this bot token already exists")

        namespace = _make_namespace(body.companyName)

        key = generate_key(namespace)
        if not key:
            raise HTTPException(status_code=500, detail="Failed to generate LiteLLM virtual key")

        tenant = Tenant(
            company_name=body.companyName,
            telegram_bot_token=body.telegramBotToken,
            pinecone_namespace=namespace,
            litellm_virtual_key=key,
            status="active",
            plan=body.plan,
        )
        db.add(tenant)
        db.commit()
        db.refresh(tenant)

        return ProvisionResponse(
            tenantId=str(tenant.id),
            companyName=tenant.company_name,
            pineconeNamespace=tenant.pinecone_namespace,
            litellmVirtualKey=tenant.litellm_virtual_key,
            botToken=tenant.telegram_bot_token,
            status=tenant.status,
            plan=tenant.plan,
        )
    finally:
        db.close()
