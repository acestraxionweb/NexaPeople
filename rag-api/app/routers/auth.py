from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import RedirectResponse
from httpx import AsyncClient
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import text

from app.config import settings
from app.database import SessionLocal
from app.models import TenantUser

router = APIRouter(prefix="/auth", tags=["auth"])


def create_jwt(user: TenantUser) -> str:
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "tenant_id": str(user.tenant_id) if user.tenant_id else None,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_jwt(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def get_current_user(
    authorization: str = Header("", alias="Authorization"),
    token: str = Query(""),
) -> dict:
    t = token
    if authorization.startswith("Bearer "):
        t = authorization[7:]
    if not t:
        raise HTTPException(status_code=401, detail="Missing token")
    return decode_jwt(t)


class CurrentUser(BaseModel):
    id: str
    email: str
    name: str | None
    role: str
    tenant_id: str | None
    tenant_name: str | None


@router.get("/me")
def auth_me(user: dict = Depends(get_current_user)) -> CurrentUser:
    db = SessionLocal()
    try:
        u = db.query(TenantUser).filter(TenantUser.id == user["sub"]).first()
        if not u:
            raise HTTPException(status_code=404, detail="User not found")
        tenant_name = None
        if u.tenant_id:
            row = db.execute(
                text("SELECT company_name FROM concierge.tenants WHERE id = :tid"),
                {"tid": u.tenant_id},
            ).first()
            if row:
                tenant_name = row[0]
        return CurrentUser(
            id=str(u.id),
            email=u.email,
            name=u.name,
            role=u.role,
            tenant_id=str(u.tenant_id) if u.tenant_id else None,
            tenant_name=tenant_name,
        )
    finally:
        db.close()


@router.get("/google/login")
async def google_login():
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
    }
    qs = "&".join(f"{k}={v}" for k, v in params.items())
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{qs}")


@router.get("/google/callback")
async def google_callback(code: str = Query(...)):
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")

    async with AsyncClient() as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
    if token_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to exchange auth code")

    tokens = token_resp.json()
    id_token = tokens.get("id_token")
    access_token = tokens.get("access_token")

    async with AsyncClient() as client:
        userinfo_resp = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if userinfo_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to get user info")

    info = userinfo_resp.json()
    google_sub = info["id"]
    email = info["email"]
    name = info.get("name", email)

    db = SessionLocal()
    try:
        user = db.query(TenantUser).filter(TenantUser.email == email).first()

        if user:
            user.google_sub = google_sub
            user.name = name
            user.last_login = datetime.now(timezone.utc)
        else:
            admin_emails = [e.strip() for e in settings.google_admin_emails.split(",") if e.strip()]
            role = "admin" if email in admin_emails else "tenant"
            user = TenantUser(
                email=email,
                name=name,
                google_sub=google_sub,
                role=role,
            )
            db.add(user)

        db.commit()
        db.refresh(user)
        token = create_jwt(user)
        frontend_url = settings.frontend_url.rstrip("/")
        return RedirectResponse(f"{frontend_url}/login?token={token}")
    finally:
        db.close()
