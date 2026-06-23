from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Header
from jose import JWTError, jwt

from app.config import settings
from app.database import SessionLocal
from app.models import Tenant
from app.services.ingestion_service import process_pdf
from app.services.tenant_service import get_tenant

router = APIRouter()


def _resolve_tenant(bot_token: str = "", authorization: str = Header("")) -> Tenant:
    if authorization.startswith("Bearer "):
        try:
            payload = jwt.decode(authorization[7:], settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        except JWTError:
            raise HTTPException(status_code=401, detail="Invalid token")
        tenant_id = payload.get("tenant_id")
        if not tenant_id:
            raise HTTPException(status_code=403, detail="User not associated with a tenant")
        db = SessionLocal()
        try:
            t = db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.status == "active").first()
            if not t:
                raise HTTPException(status_code=404, detail="Tenant not found")
            return t
        finally:
            db.close()

    if bot_token:
        t = get_tenant(bot_token)
        if not t:
            raise HTTPException(status_code=404, detail="Tenant not found or inactive")
        return t

    raise HTTPException(status_code=401, detail="No authentication provided")


@router.post("/documents/upload")
def upload_document(
    file: UploadFile = File(...),
    bot_token: str = Form(""),
    authorization: str = Header("", alias="Authorization"),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    tenant = _resolve_tenant(bot_token, authorization)
    if not tenant.pinecone_namespace:
        raise HTTPException(status_code=500, detail="Tenant has no Pinecone namespace configured")

    chunk_count = process_pdf(file.file, tenant.pinecone_namespace)

    return {
        "tenant": tenant.pinecone_namespace,
        "company": tenant.company_name,
        "filename": file.filename,
        "chunks_uploaded": chunk_count,
    }
