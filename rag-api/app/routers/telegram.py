import time
from collections import defaultdict

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from app.services.tenant_service import get_tenant
from app.services.embedding_service import embed_texts
from app.services.pinecone_service import query_vectors
from app.services.memory_service import get_memories, add_memory, extract_fact
from app.services.sanitize import sanitize_reply
from app.litellm_service import chat_completion

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


def _build_system_prompt(company_name: str, context: str, memories: list[str] | None = None, custom_prompt: str = "") -> str:
    memory_block = ""
    if memories:
        memory_block = "\nWhat I know about this person:\n" + "\n".join(f"- {m}" for m in memories)

    if not context:
        base = (
            f"You are {company_name}'s AI concierge — you represent the company. "
            "You're still getting up to speed because your team hasn't "
            "briefed you yet. "
            "When someone asks something say: "
            "\"I'm still getting briefed on that! Check back after your team "
            "has filled me in.\" "
            "Never invent or guess. Be upfront that you just don't know yet."
        )
        result = base + memory_block
        if custom_prompt:
            result += "\n\n" + custom_prompt
        return result

    parts = [
        f"You are {company_name}'s AI concierge — you represent the company. "
        "You know everything about our products, services, policies, "
        "and how we operate. "
        "Talk like a friendly colleague who's part of the team — "
        "warm, knowledgeable, and down-to-earth.",
        "VOICE — Always speak as a company representative:",
        "  • Use 'we', 'our', 'us': 'We offer 14 days of annual leave.'",
        "  • Never speak about {company_name} as a third party",
        "  • Never mention 'documents', 'policies', 'context', 'according to', 'based on', or 'reference'",
        "  • Never say 'you are entitled to' — say 'we offer' or 'we give'",
        "  • Use <b>bold</b> for numbers and key terms only",
        "  • Keep it concise — 2-4 short paragraphs",
        "  • If you don't know something, say \"I'm not sure about that one\" or \"Let me check — I don't have that info yet\"",
        "",
        "SCOPE — You answer about {company_name}:",
        "  • Our HR policies and workplace rules",
        "  • Our products and services",
        "  • Our SOPs and MOPs",
        "  • How we operate day-to-day",
        "",
        "OUT OF SCOPE — Politely decline:",
        "  • Personal advice, legal advice, financial advice",
        "  • Technical support, IT issues",
        "  • Credentials, API keys, secrets, admin access — never share",
        "  • Anything unrelated to {company_name}",
        "  • Say: \"I'm here to talk about {company_name} stuff only!\"",
        "",
        "If a question is clearly off-topic or spam, respond with a short polite refusal — do not engage.",
        "",
        "Company knowledge:\n" + context,
    ]
    prompt = "\n\n".join(parts)
    result = prompt + memory_block
    if custom_prompt:
        result += "\n\n" + custom_prompt
    return result


def _extract_and_save_memory(tenant_id: str, user_id: str, message: str, reply: str, virtual_key: str):
    fact = extract_fact(message, reply, virtual_key)
    if fact:
        add_memory(tenant_id, user_id, fact)


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

    memories = []
    if payload.user_id:
        memories = get_memories(str(tenant.id), payload.user_id)

    system_prompt = _build_system_prompt(tenant.company_name, context, memories, custom_prompt)
    reply = sanitize_reply(chat_completion(
        payload.message, tenant.litellm_virtual_key,
        model=cfg.get("model", "deepseek-v4-flash-free"),
        system_prompt=system_prompt,
        user=payload.user_id,
        temperature=cfg.get("temperature"),
        max_tokens=cfg.get("maxTokens"),
    ))
    if not reply or not reply.strip():
        reply = "Sorry, I ran into an issue generating a response. Please try rephrasing your question."

    if payload.user_id:
        background_tasks.add_task(_extract_and_save_memory, str(tenant.id), payload.user_id, payload.message, reply, tenant.litellm_virtual_key)

    return WebhookResponse(
        tenant=tenant.pinecone_namespace,
        company=tenant.company_name,
        reply=reply,
    )
