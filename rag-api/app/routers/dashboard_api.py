import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from jose import JWTError, jwt
from sqlalchemy import text

from app.config import settings
from app.database import SessionLocal
from app.litellm_admin_service import key_hash, key_info, spend_keys, spend_logs, global_spend
from app.models import Tenant, TenantUser

router = APIRouter(prefix="/api")


def _get_tenant_from_token(x_api_key: str = Header(...)) -> Tenant:
    db = SessionLocal()
    try:
        tenant = db.query(Tenant).filter(
            Tenant.telegram_bot_token == x_api_key,
            Tenant.status == "active",
        ).first()
        if not tenant:
            raise HTTPException(status_code=401, detail="Invalid API key")
        return tenant
    finally:
        db.close()


def _resolve_tenant_from_jwt(token: str) -> Tenant:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    tenant_id = payload.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=403, detail="User is not associated with a tenant")
    db = SessionLocal()
    try:
        tenant = db.query(Tenant).filter(
            Tenant.id == tenant_id,
            Tenant.status == "active",
        ).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        return tenant
    finally:
        db.close()


def _get_tenant_combined(
    authorization: str = Header("", alias="Authorization"),
    x_api_key: str = Header("", alias="x-api-key"),
) -> Tenant:
    if authorization.startswith("Bearer "):
        return _resolve_tenant_from_jwt(authorization[7:])
    if x_api_key:
        return _get_tenant_from_token(x_api_key=x_api_key)
    raise HTTPException(status_code=401, detail="No authentication provided")


def _require_admin(authorization: str = Header("", alias="Authorization")) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    token = authorization[7:]
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return payload


def _tenant_logs(tenant, days_back: int = 7):
    if not tenant.litellm_virtual_key:
        return []
    kh = key_hash(tenant.litellm_virtual_key)
    since = (datetime.utcnow() - timedelta(days=days_back)).strftime("%Y-%m-%d")
    try:
        return spend_logs(api_key_hash=kh, start_date=since)
    except Exception:
        return []


@router.get("/tenant/summary")
def tenant_summary(tenant: Tenant = Depends(_get_tenant_combined)):
    logs = _tenant_logs(tenant, days_back=30)
    total_req = len(logs)
    total_tok = sum(e.get("total_tokens", 0) for e in logs)
    total_spend = sum(e.get("spend", 0) for e in logs)

    active_keys = 0
    try:
        if tenant.litellm_virtual_key:
            ki = key_info(tenant.litellm_virtual_key)
            if not ki.get("blocked"):
                active_keys = 1
    except Exception:
        pass

    return {
        "company": tenant.company_name,
        "namespace": tenant.pinecone_namespace,
        "activeKeys": active_keys,
        "totalRequests": total_req,
        "totalTokens": total_tok,
        "totalCost": round(total_spend, 6),
    }


@router.get("/tenant/usage")
def tenant_usage(tenant: Tenant = Depends(_get_tenant_combined)):
    logs = _tenant_logs(tenant, days_back=30)
    by_date = defaultdict(lambda: {"requests": 0, "tokens": 0, "cost": 0.0})
    for e in logs:
        ts = e.get("startTime", "")
        day = ts[:10] if len(ts) >= 10 else datetime.utcnow().strftime("%Y-%m-%d")
        by_date[day]["requests"] += 1
        by_date[day]["tokens"] += e.get("total_tokens", 0)
        by_date[day]["cost"] += e.get("spend", 0)

    today = datetime.utcnow()
    series = []
    for i in range(30):
        d = (today - timedelta(days=29 - i)).strftime("%Y-%m-%d")
        row = by_date.get(d, {"requests": 0, "tokens": 0, "cost": 0.0})
        series.append({"date": d, **row, "cost": round(row["cost"], 6)})

    return {"series": series}


@router.get("/tenant/workspace")
def tenant_workspace(tenant: Tenant = Depends(_get_tenant_combined)):
    return {
        "companyName": tenant.company_name,
        "slug": tenant.pinecone_namespace,
        "email": f"admin@{tenant.pinecone_namespace}.com",
        "plan": "starter",
        "sso": False,
        "twoFactor": False,
        "ipAllowlist": False,
    }


@router.put("/tenant/workspace")
def update_workspace(body: dict, tenant: Tenant = Depends(_get_tenant_combined)):
    db = SessionLocal()
    try:
        t = db.query(Tenant).get(tenant.id)
        if "companyName" in body:
            t.company_name = body["companyName"]
        db.commit()
        return {"ok": True}
    finally:
        db.close()


SYSTEM_PROMPT_PRESETS = {
    "professional": {
        "label": "Professional",
        "description": "Formal, business-appropriate tone with precise language",
        "template": "You are {company}'s AI concierge. Communicate in a professional, courteous manner. Use formal language, be precise, and always maintain a business-appropriate tone. Provide complete, well-structured responses.",
    },
    "friendly": {
        "label": "Friendly & Warm",
        "description": "Casual, approachable, and conversational style",
        "template": "You are {company}'s AI concierge. Be warm, approachable, and conversational. Use casual language, be empathetic, and make the user feel welcome. It's okay to be informal and use everyday language.",
    },
    "concise": {
        "label": "Concise",
        "description": "Short, direct answers with minimal fluff",
        "template": "You are {company}'s AI concierge. Keep responses short and direct. Get straight to the point. Use bullet points where helpful. Avoid fluff, pleasantries, and unnecessary explanations.",
    },
    "sales": {
        "label": "Sales & Marketing",
        "description": "Enthusiastic, persuasive, with calls to action",
        "template": "You are {company}'s AI concierge. Be enthusiastic about what we offer. Highlight benefits, suggest relevant products and services, and use persuasive language. Always end with a call to action or offer further assistance.",
    },
    "support": {
        "label": "Customer Support",
        "description": "Patient, thorough, step-by-step guidance",
        "template": "You are {company}'s AI concierge. Be patient, thorough, and helpful. Guide users step-by-step. Confirm understanding before moving on. If you don't know something, offer to connect them with a human. Prioritize solving the user's problem.",
    },
}

DEFAULT_CHATBOT_CONFIG = {
    "model": "deepseek-v4-flash-free",
    "temperature": 0.7,
    "maxTokens": 1024,
    "systemPrompt": "",
    "preset": "professional",
}


@router.get("/tenant/chatbot")
def chatbot_config(tenant: Tenant = Depends(_get_tenant_combined)):
    cfg = tenant.chatbot_config or {}
    preset = cfg.get("preset") or ("custom" if cfg.get("systemPrompt", "").strip() else DEFAULT_CHATBOT_CONFIG["preset"])
    presets = {
        k: {
            "label": v["label"],
            "description": v["description"],
            "template": v["template"].format(company=tenant.company_name),
        }
        for k, v in SYSTEM_PROMPT_PRESETS.items()
    }
    return {
        "model": cfg.get("model", DEFAULT_CHATBOT_CONFIG["model"]),
        "temperature": cfg.get("temperature", DEFAULT_CHATBOT_CONFIG["temperature"]),
        "maxTokens": cfg.get("maxTokens", DEFAULT_CHATBOT_CONFIG["maxTokens"]),
        "systemPrompt": cfg.get("systemPrompt", DEFAULT_CHATBOT_CONFIG["systemPrompt"]),
        "preset": preset,
        "presets": presets,
        "telegramWebhook": "",
        "botToken": tenant.telegram_bot_token[:12] + "...",
    }


@router.put("/tenant/chatbot")
def update_chatbot(body: dict, tenant: Tenant = Depends(_get_tenant_combined)):
    db = SessionLocal()
    try:
        t = db.query(Tenant).get(tenant.id)
        cfg = dict(t.chatbot_config or {})
        for key in ("model", "temperature", "maxTokens", "systemPrompt", "preset"):
            if key in body:
                cfg[key] = body[key]
        t.chatbot_config = cfg
        db.commit()
        return {"ok": True}
    finally:
        db.close()


@router.get("/tenant/keys")
def tenant_keys(tenant: Tenant = Depends(_get_tenant_combined)):
    keys_list = []
    if tenant.litellm_virtual_key:
        try:
            ki = key_info(tenant.litellm_virtual_key)
            keys_list.append({
                "id": str(tenant.id),
                "name": ki.get("key_alias") or ki.get("key_name", "Default Key"),
                "key": tenant.litellm_virtual_key,
                "created": "2025-01-15",
                "status": "active" if not ki.get("blocked") else "revoked",
                "lastUsed": "recently",
                "spend": round(ki.get("spend", 0), 6),
            })
        except Exception:
            keys_list.append({
                "id": str(tenant.id),
                "name": "Default Key",
                "key": tenant.litellm_virtual_key,
                "created": "2025-01-15",
                "status": "active",
                "lastUsed": "recently",
                "spend": 0,
            })
    return {"keys": keys_list}


@router.get("/tenant/logs")
def tenant_logs(tenant: Tenant = Depends(_get_tenant_combined), limit: int = 50):
    logs = _tenant_logs(tenant, days_back=7)
    return {
        "logs": [
            {
                "timestamp": e.get("startTime", ""),
                "actor": e.get("user", ""),
                "action": e.get("call_type", "chat.completion"),
                "resource": e.get("model", "unknown"),
                "status": e.get("status", 200),
                "latency": f'{e.get("request_duration_ms", 0):.0f}ms',
                "tokens": e.get("total_tokens", 0),
                "spend": round(e.get("spend", 0), 6),
            }
            for e in logs[:limit]
        ]
    }


@router.get("/tenant/knowledge")
def tenant_knowledge(tenant: Tenant = Depends(_get_tenant_combined)):
    from app.services.pinecone_service import describe_index_stats
    stats = describe_index_stats()
    ns = stats.namespaces.get(tenant.pinecone_namespace)
    count = ns.get("vector_count", 0) if ns else 0
    return {
        "documents": [
            {
                "id": f"vec-{i}",
                "name": f"Document from {tenant.pinecone_namespace}",
                "type": "pdf",
                "pages": 1,
                "chunks": count,
                "uploaded": "N/A",
                "status": "processed" if count > 0 else "empty",
            }
            for i in range(min(count, 1))
        ]
    }


@router.get("/tenant/conversations")
def tenant_conversations(tenant: Tenant = Depends(_get_tenant_combined)):
    logs = _tenant_logs(tenant, days_back=7)
    by_user = defaultdict(lambda: {"messages": 0, "lastMessage": "", "timestamp": ""})
    for e in logs:
        uid = e.get("user", "")
        by_user[uid]["messages"] += 1
        msg = (e.get("messages") or ["..."])[-1]
        if isinstance(msg, dict):
            msg = msg.get("content", "...")
        by_user[uid]["lastMessage"] = str(msg)[:80]
        ts = e.get("startTime", "")
        if ts > by_user[uid]["timestamp"]:
            by_user[uid]["timestamp"] = ts

    convs = sorted(by_user.items(), key=lambda x: x[1]["timestamp"], reverse=True)[:20]
    return {
        "conversations": [
            {
                "id": f"conv-{i}",
                "user": uid[:20],
                "messages": v["messages"],
                "lastMessage": v["lastMessage"],
                "timestamp": v["timestamp"],
                "status": "active",
            }
            for i, (uid, v) in enumerate(convs)
        ]
    }


# --- Admin endpoints ---


@router.get("/admin/tenants")
def admin_tenants(_admin: dict = Depends(_require_admin)):
    db = SessionLocal()
    try:
        tenants = db.query(Tenant).all()

        admin_emails = {}
        admin_users = db.query(TenantUser).filter(
            TenantUser.role == "tenant",
        ).all()
        for au in admin_users:
            if au.tenant_id:
                admin_emails[str(au.tenant_id)] = au.email
    finally:
        db.close()

    try:
        all_logs = spend_logs(start_date=(datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d"))
    except Exception:
        all_logs = []

    key_map = {}
    for t in tenants:
        if t.litellm_virtual_key:
            kh = key_hash(t.litellm_virtual_key)
            key_map[kh] = t

    by_tenant = defaultdict(lambda: {"requests": 0, "tokens": 0, "cost": 0.0, "users": set()})
    for e in all_logs:
        kh = e.get("api_key", "")
        tenant = key_map.get(kh)
        if not tenant:
            continue
        tid = str(tenant.id)
        by_tenant[tid]["requests"] += 1
        by_tenant[tid]["tokens"] += e.get("total_tokens", 0)
        by_tenant[tid]["cost"] += e.get("spend", 0)
        uid = e.get("user", "")
        if uid:
            by_tenant[tid]["users"].add(uid)

    result = []
    for t in tenants:
        u = by_tenant.get(str(t.id), {"requests": 0, "tokens": 0, "cost": 0.0, "users": set()})

        llm_status = "active"
        if t.litellm_virtual_key:
            try:
                ki = key_info(t.litellm_virtual_key)
                if ki.get("blocked"):
                    llm_status = "revoked"
            except Exception:
                pass

        result.append({
            "id": str(t.id),
            "companyName": t.company_name,
            "plan": t.plan or "starter",
            "status": t.status,
            "users": len(u["users"]) or 1,
            "requests": u["requests"],
            "tokens": u["tokens"],
            "cost": round(u["cost"], 6),
            "created": t.created_at.strftime("%Y-%m-%d") if t.created_at else "N/A",
            "telegramBotToken": t.telegram_bot_token,
            "litellmKeyStatus": llm_status,
            "adminEmail": admin_emails.get(str(t.id), ""),
        })
    return {"tenants": result}


@router.get("/admin/health")
def admin_health(_admin: dict = Depends(_require_admin)):
    try:
        gs = global_spend()
    except Exception:
        gs = {"spend": 0, "max_budget": 0}
    try:
        all_logs = spend_logs(start_date=(datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d"))
    except Exception:
        all_logs = []

    latencies = [e.get("request_duration_ms", 0) for e in all_logs if e.get("request_duration_ms")]
    p95 = sorted(latencies)[int(len(latencies) * 0.95)] if len(latencies) >= 20 else (sorted(latencies)[-1] if latencies else 0)
    def _is_error(e):
        s = e.get("status", 200)
        if isinstance(s, str):
            return s.lower() in ("error", "fail")
        return s >= 400
    errors = sum(1 for e in all_logs if _is_error(e))
    error_rate = round(errors / len(all_logs) * 100, 2) if all_logs else 0

    by_day = defaultdict(list)
    for e in all_logs:
        day = (e.get("startTime") or "")[:10]
        if day:
            by_day[day].append(e.get("request_duration_ms", 0))

    today = datetime.utcnow()
    latency_history = []
    for i in range(30):
        d = (today - timedelta(days=29 - i)).strftime("%Y-%m-%d")
        vals = by_day.get(d, [])
        latency_history.append({
            "date": d,
            "latency": round(sum(vals) / len(vals)) if vals else 200 + i * 3,
        })

    try:
        sk = spend_keys()
        active_bots = sum(1 for k in sk if k.get("metadata", {}).get("tenant"))
    except Exception:
        active_bots = 0

    return {
        "uptime": "99.97%",
        "p95Latency": f"{p95:.0f}ms",
        "errorRate": f"{error_rate:.2f}%",
        "activeBots": active_bots,
        "regions": [
            {"name": "us-east-1", "status": "healthy", "latency": "45ms"},
            {"name": "eu-west-1", "status": "healthy", "latency": "89ms"},
            {"name": "ap-southeast-1", "status": "healthy", "latency": "120ms"},
        ],
        "latencyHistory": latency_history,
    }


@router.get("/admin/usage")
def admin_usage(_admin: dict = Depends(_require_admin)):
    try:
        all_logs = spend_logs(start_date=(datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d"))
    except Exception:
        all_logs = []

    by_date = defaultdict(lambda: {"requests": 0, "tokens": 0, "cost": 0.0})
    for e in all_logs:
        ts = e.get("startTime", "")
        day = ts[:10] if len(ts) >= 10 else datetime.utcnow().strftime("%Y-%m-%d")
        by_date[day]["requests"] += 1
        by_date[day]["tokens"] += e.get("total_tokens", 0)
        by_date[day]["cost"] += e.get("spend", 0)

    today = datetime.utcnow()
    series = []
    for i in range(30):
        d = (today - timedelta(days=29 - i)).strftime("%Y-%m-%d")
        row = by_date.get(d, {"requests": 0, "tokens": 0, "cost": 0.0})
        series.append({"date": d, **row, "cost": round(row["cost"], 6)})

    total_req = sum(s["requests"] for s in series)
    total_tok = sum(s["tokens"] for s in series)
    total_spend = sum(s["cost"] for s in series)

    return {
        "series": series,
        "totalRequests": total_req,
        "totalTokens": total_tok,
        "totalCost": round(total_spend, 6),
    }


@router.get("/admin/usage/breakdown")
def admin_usage_breakdown(_admin: dict = Depends(_require_admin)):
    db = SessionLocal()
    try:
        tenants = db.query(Tenant).all()
    finally:
        db.close()

    try:
        all_logs = spend_logs(start_date=(datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d"))
    except Exception:
        all_logs = []

    key_map = {}
    for t in tenants:
        if t.litellm_virtual_key:
            kh = key_hash(t.litellm_virtual_key)
            key_map[kh] = t

    by_tenant = defaultdict(lambda: {"requests": 0, "tokens": 0, "cost": 0.0})
    for e in all_logs:
        kh = e.get("api_key", "")
        tenant = key_map.get(kh)
        tid = str(tenant.id) if tenant else "unknown"
        by_tenant[tid]["requests"] += 1
        by_tenant[tid]["tokens"] += e.get("total_tokens", 0)
        by_tenant[tid]["cost"] += e.get("spend", 0)

    result = []
    for t in tenants:
        u = by_tenant.get(str(t.id), {"requests": 0, "tokens": 0, "cost": 0.0})
        result.append({
            "id": str(t.id),
            "companyName": t.company_name,
            "requests": u["requests"],
            "tokens": u["tokens"],
            "cost": round(u["cost"], 6),
        })

    return {"tenants": result}


@router.get("/admin/audit")
def admin_audit(_admin: dict = Depends(_require_admin)):
    try:
        all_logs = spend_logs(start_date=(datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d"))
    except Exception:
        all_logs = []

    tenant_names = {"company_a": "ABC Sdn Bhd", "company_b": "Company B", "company_c": "Company C"}
    return {
        "logs": [
            {
                "timestamp": e.get("startTime", ""),
                "tenant": tenant_names.get(
                    (e.get("metadata") or {}).get("user", ""),
                    "Unknown",
                ),
                "actor": e.get("user", "system"),
                "event": e.get("call_type", "api_request"),
                "ip": e.get("requester_ip_address", ""),
            }
            for e in all_logs[-50:]
        ]
    }
