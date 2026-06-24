import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.database import SessionLocal
from app.litellm_admin_service import block_key, generate_key
from app.models import Tenant, TenantUser
from app.routers.dashboard_api import _require_admin

router = APIRouter(prefix="/api/admin")


class ProvisionRequest(BaseModel):
    companyName: str
    telegramBotToken: str
    plan: str = "starter"
    adminEmail: str = ""


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
def provision(body: ProvisionRequest, _admin: dict = Depends(_require_admin)):
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

        if body.adminEmail:
            existing_user = db.query(TenantUser).filter(
                TenantUser.email == body.adminEmail
            ).first()
            if existing_user:
                existing_user.tenant_id = tenant.id
                existing_user.role = "tenant"
            else:
                db.add(TenantUser(
                    email=body.adminEmail,
                    name=body.adminEmail.split("@")[0],
                    tenant_id=tenant.id,
                    role="tenant",
                ))
            db.commit()

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


class UpdateTenantRequest(BaseModel):
    companyName: str | None = None
    adminEmail: str | None = None
    botToken: str | None = None
    litellmVirtualKey: str | None = None
    blockOldKey: bool = False


class UpdateTenantResponse(BaseModel):
    tenantId: str
    companyName: str
    pineconeNamespace: str
    botToken: str
    adminEmail: str | None
    status: str
    plan: str
    litellmVirtualKey: str | None
    oldKeyBlocked: bool


@router.put("/tenants/{tenant_id}", response_model=UpdateTenantResponse)
def update_tenant(tenant_id: str, body: UpdateTenantRequest, _admin: dict = Depends(_require_admin)):
    db = SessionLocal()
    try:
        t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not t:
            raise HTTPException(status_code=404, detail="Tenant not found")

        old_key = t.litellm_virtual_key
        old_bot_token = t.telegram_bot_token
        old_key_blocked = False

        if body.companyName is not None:
            t.company_name = body.companyName

        if body.botToken is not None:
            if body.botToken != t.telegram_bot_token:
                conflict = db.query(Tenant).filter(
                    Tenant.telegram_bot_token == body.botToken,
                    Tenant.id != t.id,
                ).first()
                if conflict:
                    raise HTTPException(status_code=409, detail="A tenant with this bot token already exists")
                t.telegram_bot_token = body.botToken

        if body.litellmVirtualKey is not None:
            t.litellm_virtual_key = body.litellmVirtualKey
            if body.blockOldKey and old_key:
                old_key_blocked = block_key(old_key)

        db.commit()
        db.refresh(t)

        admin_email = None
        if body.adminEmail is not None:
            admin_user = db.query(TenantUser).filter(
                TenantUser.tenant_id == t.id,
                TenantUser.role == "tenant",
            ).first()
            if admin_user:
                admin_user.email = body.adminEmail
                db.commit()
                admin_email = body.adminEmail
            else:
                existing = db.query(TenantUser).filter(
                    TenantUser.email == body.adminEmail
                ).first()
                if existing:
                    existing.tenant_id = t.id
                    existing.role = "tenant"
                else:
                    db.add(TenantUser(
                        email=body.adminEmail,
                        name=body.adminEmail.split("@")[0],
                        tenant_id=t.id,
                        role="tenant",
                    ))
                db.commit()
                admin_email = body.adminEmail
        else:
            admin_user = db.query(TenantUser).filter(
                TenantUser.tenant_id == t.id,
                TenantUser.role == "tenant",
            ).first()
            if admin_user:
                admin_email = admin_user.email

        return UpdateTenantResponse(
            tenantId=str(t.id),
            companyName=t.company_name,
            pineconeNamespace=t.pinecone_namespace,
            botToken=t.telegram_bot_token,
            adminEmail=admin_email,
            status=t.status,
            plan=t.plan,
            litellmVirtualKey=t.litellm_virtual_key,
            oldKeyBlocked=old_key_blocked,
        )
    finally:
        db.close()
