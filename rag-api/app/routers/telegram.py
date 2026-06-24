import logging
import time
from collections import defaultdict

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from app.services.tenant_service import get_tenant
from app.services.embedding_service import embed_texts
from app.services.pinecone_service import query_vectors
from app.services.memory_service import get_memories, add_conversation_turn
from app.services.sanitize import sanitize_reply
from app.litellm_service import chat_completion

logger = logging.getLogger("concierge.telegram")

router = APIRouter()

_rate_limit: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_WINDOW = 10
RATE_LIMIT_MAX = 5


def _check_rate_limit(bot_token: str):
    now = time.time()
    window = now - RATE_LIMIT_WINDOW
    _rate_limit[bot_token] = [t for t in _rate_limit[bot_token] if t > window]
    if len(_rate_limit[bot_token]) >= RATE_LIMIT_MAX:
        raise HTTPException(status_code=429, detail="Too many requests. Please slow down.")
    _rate_limit[bot_token].append(now)


class WebhookPayload(BaseModel):
    bot_token: str
    message: str
    user_id: str | None = None


class WebhookResponse(BaseModel):
    tenant: str
    company: str
    reply: str


def _build_context(namespace: str, question: str) -> str:
    query_vec = embed_texts([question])[0]
    results = query_vectors(query_vec, namespace, top_k=5)
    if not results.matches:
        return ""
    chunks = []
    for m in results.matches:
        if text := m.metadata.get("text"):
            chunks.append(text)
    return "\n\n".join(chunks)


def _build_system_prompt(company_name: str, context: str, history: list[dict] | None = None, custom_prompt: str = "") -> str:
    history_block = ""
    if history:
        lines = []
        for m in history:
            lines.append(f"User: {m['user']}")
            lines.append(f"Assistant: {m['assistant']}")
        history_block = "\nRecent conversation:\n" + "\n".join(lines)

    if custom_prompt:
        parts = [custom_prompt]
    elif context:
        parts = [
            f"You are {company_name}'s AI concierge. You represent the company and have access "
            "to its knowledge base to answer questions accurately. "
            "Be warm, helpful, and professional. If you don't know something, say so rather than guessing.",
        ]
    else:
        parts = [
            f"You are {company_name}'s AI concierge. You're still learning about the company's "
            "operations so you may not have all the answers yet. "
            "When asked something you don't know, politely say you're still getting up to speed "
            "and suggest they check back later. Never invent or guess.",
        ]

    if context:
        parts.append("Company knowledge:\n" + context)

    result = "\n\n".join(parts)
    if history_block:
        result += history_block
    return result


def _save_conversation_data(tenant_id: str, user_id: str, message: str, reply: str, virtual_key: str):
    add_conversation_turn(tenant_id, user_id, message, reply)


@router.post("/webhook/telegram", response_model=WebhookResponse)
def webhook_telegram(payload: WebhookPayload, background_tasks: BackgroundTasks):
    _check_rate_limit(payload.bot_token)
    tenant = get_tenant(payload.bot_token)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found or inactive")

    if not tenant.litellm_virtual_key:
        raise HTTPException(status_code=500, detail="Tenant has no LiteLLM virtual key configured")

    if tenant.pinecone_namespace:
        context = _build_context(tenant.pinecone_namespace, payload.message)
    else:
        context = ""

    cfg = tenant.chatbot_config or {}
    custom_prompt = cfg.get("systemPrompt", "")

    history: list[dict] = []
    if payload.user_id:
        history = get_memories(str(tenant.id), payload.user_id)

    system_prompt = _build_system_prompt(tenant.company_name, context, history, custom_prompt)
    effective_model = cfg.get("modelAlias") or cfg.get("model", "deepseek-v4-flash-free")
    logger.info(
        "[%s] user=%s msg=%s model=%s history=%d context=%d",
        tenant.company_name, payload.user_id, payload.message,
        effective_model,
        len(history), len(context),
    )

    model_alias = cfg.get("modelAlias") or ""
    reply = sanitize_reply(chat_completion(
        payload.message, tenant.litellm_virtual_key,
        model=model_alias or cfg.get("model", "deepseek-v4-flash-free"),
        system_prompt=system_prompt,
        user=payload.user_id,
        temperature=cfg.get("temperature"),
        max_tokens=cfg.get("maxTokens"),
    ))
    if not reply or not reply.strip():
        reply = "Sorry, I ran into an issue generating a response. Please try rephrasing your question."

    logger.info(
        "[%s] reply_len=%d reply=%.200s",
        tenant.company_name, len(reply), reply,
    )

    if payload.user_id:
        background_tasks.add_task(_save_conversation_data, str(tenant.id), payload.user_id, payload.message, reply, tenant.litellm_virtual_key)

    return WebhookResponse(
        tenant=tenant.pinecone_namespace,
        company=tenant.company_name,
        reply=reply,
    )
