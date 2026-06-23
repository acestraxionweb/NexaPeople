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
    text("""
        CREATE TABLE IF NOT EXISTS concierge.tenant_users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email TEXT UNIQUE NOT NULL,
            name TEXT,
            google_sub TEXT UNIQUE,
            tenant_id UUID REFERENCES concierge.tenants(id) ON DELETE SET NULL,
            role TEXT NOT NULL DEFAULT 'tenant',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            last_login TIMESTAMPTZ
        );
    """),
    text("CREATE INDEX IF NOT EXISTS idx_tenant_users_email ON concierge.tenant_users(email);"),
]


def run():
    with engine.connect() as conn:
        for sql in MIGRATIONS:
            conn.execute(sql)
        conn.commit()
        print("Migrations applied successfully")


if __name__ == "__main__":
    run()
