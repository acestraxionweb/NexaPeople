import uuid
from datetime import datetime, timezone

from sqlalchemy import text

from app.database import SessionLocal
from app.litellm_service import chat_completion


def get_memories(tenant_id: str, user_id: str) -> dict:
    db = SessionLocal()
    try:
        fact_rows = db.execute(
            text("""
                SELECT fact FROM concierge.memories
                WHERE tenant_id = :tid AND user_id = :uid AND type = 'fact'
                ORDER BY created_at DESC
                LIMIT 3
            """),
            {"tid": tenant_id, "uid": user_id},
        ).fetchall()

        msg_rows = db.execute(
            text("""
                SELECT user_msg, bot_reply FROM concierge.memories
                WHERE tenant_id = :tid AND user_id = :uid AND type = 'message'
                ORDER BY created_at DESC
                LIMIT 3
            """),
            {"tid": tenant_id, "uid": user_id},
        ).fetchall()

        return {
            "facts": [row[0] for row in fact_rows],
            "messages": [{"user": row[0], "assistant": row[1]} for row in reversed(msg_rows)],
        }
    finally:
        db.close()


def add_memory(tenant_id: str, user_id: str, fact: str):
    db = SessionLocal()
    try:
        existing = db.execute(
            text("SELECT 1 FROM concierge.memories WHERE tenant_id = :tid AND user_id = :uid AND fact = :fact AND type = 'fact'"),
            {"tid": tenant_id, "uid": user_id, "fact": fact},
        ).fetchone()
        if existing:
            return
        db.execute(
            text("""
                INSERT INTO concierge.memories (id, tenant_id, user_id, type, fact, created_at)
                VALUES (:id, :tid, :uid, 'fact', :fact, :now)
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
                WHERE tenant_id = :tid AND user_id = :uid AND type = 'fact'
                AND id NOT IN (
                    SELECT id FROM concierge.memories
                    WHERE tenant_id = :tid AND user_id = :uid AND type = 'fact'
                    ORDER BY created_at DESC
                    LIMIT 3
                )
            """),
            {"tid": tenant_id, "uid": user_id},
        )
        db.commit()
    finally:
        db.close()


def add_conversation_turn(tenant_id: str, user_id: str, user_msg: str, bot_reply: str):
    db = SessionLocal()
    try:
        db.execute(
            text("""
                INSERT INTO concierge.memories (id, tenant_id, user_id, type, user_msg, bot_reply, created_at)
                VALUES (:id, :tid, :uid, 'message', :user_msg, :bot_reply, :now)
            """),
            {
                "id": uuid.uuid4(),
                "tid": tenant_id,
                "uid": user_id,
                "user_msg": user_msg,
                "bot_reply": bot_reply,
                "now": datetime.now(timezone.utc),
            },
        )
        db.execute(
            text("""
                DELETE FROM concierge.memories
                WHERE tenant_id = :tid AND user_id = :uid AND type = 'message'
                AND id NOT IN (
                    SELECT id FROM concierge.memories
                    WHERE tenant_id = :tid AND user_id = :uid AND type = 'message'
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
