from sqlalchemy import text

from app.database import engine

MIGRATIONS = [
    text("ALTER TABLE concierge.tenants ADD COLUMN IF NOT EXISTS plan VARCHAR DEFAULT 'starter' NOT NULL;"),
    text("ALTER TABLE concierge.tenants ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();"),
    text("""
        CREATE TABLE IF NOT EXISTS concierge.memories (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES concierge.tenants(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL,
            fact TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    """),
    text("CREATE INDEX IF NOT EXISTS idx_memories_lookup ON concierge.memories(tenant_id, user_id, created_at DESC);"),
]


def run():
    with engine.connect() as conn:
        for sql in MIGRATIONS:
            conn.execute(sql)
        conn.commit()
        print("Migrations applied successfully")


if __name__ == "__main__":
    run()
