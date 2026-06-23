import uuid
from datetime import datetime, timezone

from sqlalchemy import text

from app.database import SessionLocal
from app.litellm_service import chat_completion


def get_memories(tenant_id: str, user_id: str) -> list[str]:
    db = SessionLocal()
    try:
        rows = db.execute(
            text("""
                SELECT fact FROM concierge.memories
                WHERE tenant_id = :tid AND user_id = :uid
                ORDER BY created_at DESC
                LIMIT 3
            """),
            {"tid": tenant_id, "uid": user_id},
        ).fetchall()
        return [row[0] for row in rows]
    finally:
        db.close()


def add_memory(tenant_id: str, user_id: str, fact: str):
    db = SessionLocal()
    try:
        existing = db.execute(
            text("SELECT 1 FROM concierge.memories WHERE tenant_id = :tid AND user_id = :uid AND fact = :fact"),
            {"tid": tenant_id, "uid": user_id, "fact": fact},
        ).fetchone()
        if existing:
            return
        db.execute(
            text("""
                INSERT INTO concierge.memories (id, tenant_id, user_id, fact, created_at)
                VALUES (:id, :tid, :uid, :fact, :now)
            """),
            {
                "id": uuid.uuid4(),
                "tid": tenant_id,
                "uid": user_id,
                "fact": fact,
                "now": datetime.now(timezone.utc),
            },
        )
        db.execute(
            text("""
                DELETE FROM concierge.memories
                WHERE (tenant_id, user_id) = (:tid, :uid)
                AND id NOT IN (
                    SELECT id FROM concierge.memories
                    WHERE tenant_id = :tid AND user_id = :uid
                    ORDER BY created_at DESC
                    LIMIT 3
                )
            """),
            {"tid": tenant_id, "uid": user_id},
        )
        db.commit()
    finally:
        db.close()


def extract_fact(user_msg: str, bot_reply: str, virtual_key: str) -> str | None:
    prompt = (
        "You are a memory extraction system. Given a user message and the assistant's reply, "
        "extract ONE personal fact about the user that would be useful to remember for future conversations "
        "(e.g. their name, preference, role, important context about them). "
        "Return ONLY the fact as a plain string, or return an empty string if there's nothing worth remembering. "
        "Keep it under 100 characters. Do not add prefixes or labels."
    )
    messages = f"User: {user_msg}\nAssistant: {bot_reply}"
    result = chat_completion(messages, virtual_key, model="deepseek-v4-flash-free", system_prompt=prompt)
    fact = result.strip().strip('"')
    if not fact or len(fact) < 3:
        return None
    return fact
