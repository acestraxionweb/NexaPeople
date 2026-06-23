from fastapi import APIRouter, HTTPException, UploadFile, File, Form

from app.services.ingestion_service import process_pdf
from app.services.tenant_service import get_tenant

router = APIRouter()


@router.post("/documents/upload")
def upload_document(
    file: UploadFile = File(...),
    bot_token: str = Form(...),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    tenant = get_tenant(bot_token)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found or inactive")
    if not tenant.pinecone_namespace:
        raise HTTPException(status_code=500, detail="Tenant has no Pinecone namespace configured")

    chunk_count = process_pdf(file.file, tenant.pinecone_namespace)

    return {
        "tenant": tenant.pinecone_namespace,
        "company": tenant.company_name,
        "filename": file.filename,
        "chunks_uploaded": chunk_count,
    }
