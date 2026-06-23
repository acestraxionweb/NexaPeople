import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.database import SessionLocal
from app.models import Tenant
from app.routers.telegram import _build_context, _build_system_prompt, _check_rate_limit, _extract_and_save_memory
from app.services.memory_service import get_memories
from app.services.sanitize import sanitize_reply
from app.litellm_service import chat_completion

router = APIRouter()

TELEGRAM_API = "https://api.telegram.org"


@router.post("/webhook/telegram/{bot_token}")
def telegram_webhook(bot_token: str, update: dict, background_tasks: BackgroundTasks):
    _check_rate_limit(bot_token)

    db = SessionLocal()
    try:
        tenant = db.query(Tenant).filter(
            Tenant.telegram_bot_token == bot_token,
            Tenant.status == "active",
        ).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found or inactive")
        if not tenant.litellm_virtual_key:
            raise HTTPException(status_code=500, detail="Tenant has no LiteLLM virtual key")
    finally:
        db.close()

    msg = update.get("message") or {}
    text = msg.get("text", "")
    chat_id = msg.get("chat", {}).get("id")
    if not text or not chat_id:
        return {"ok": True}

    user_id = str(chat_id)

    if text == "/start":
        welcome = (
            "<b>Hey there! 👋</b>\n\n"
            "I'm the company concierge. Ask me anything about our "
            "products, services, policies, or how things work around here."
        )
        with httpx.Client() as client:
            client.post(
                f"{TELEGRAM_API}/bot{bot_token}/sendMessage",
                json={"chat_id": chat_id, "text": welcome, "parse_mode": "HTML"},
                timeout=15,
            )
        return {"ok": True}

    cfg = tenant.chatbot_config or {}
    custom_prompt = cfg.get("systemPrompt", "")

    if tenant.pinecone_namespace:
        context = _build_context(tenant.pinecone_namespace, text)
    else:
        context = ""

    memories = get_memories(str(tenant.id), user_id)
    system_prompt = _build_system_prompt(tenant.company_name, context, memories, custom_prompt)
    reply = sanitize_reply(chat_completion(
        text, tenant.litellm_virtual_key,
        model=cfg.get("model", "deepseek-v4-flash-free"),
        system_prompt=system_prompt,
        user=user_id,
        temperature=cfg.get("temperature"),
        max_tokens=cfg.get("maxTokens"),
    ))
    if not reply or not reply.strip():
        reply = "Sorry, I ran into an issue generating a response. Please try rephrasing your question."

    background_tasks.add_task(_extract_and_save_memory, str(tenant.id), user_id, text, reply, tenant.litellm_virtual_key)

    with httpx.Client() as client:
        resp = client.post(
            f"{TELEGRAM_API}/bot{bot_token}/sendMessage",
            json={
                "chat_id": chat_id,
                "text": reply,
                "parse_mode": "HTML",
            },
            timeout=30,
        )
        if resp.status_code != 200:
            print(f"Telegram sendMessage failed: {resp.status_code} {resp.text[:200]}")

    return {"ok": True}
