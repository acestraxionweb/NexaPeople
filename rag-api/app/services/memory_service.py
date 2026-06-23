import uuid
from datetime import datetime, timezone

from sqlalchemy import text

from app.database import SessionLocal


def get_memories(tenant_id: str, user_id: str) -> list[dict]:
    db = SessionLocal()
    try:
        rows = db.execute(
            text("""
                SELECT user_msg, bot_reply FROM concierge.memories
                WHERE tenant_id = :tid AND user_id = :uid AND type = 'message'
                ORDER BY created_at DESC
                LIMIT 3
            """),
            {"tid": tenant_id, "uid": user_id},
        ).fetchall()
        return [{"user": row[0], "assistant": row[1]} for row in reversed(rows)]
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
