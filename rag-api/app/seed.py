from sqlalchemy import text
from app.database import SessionLocal, engine, Base
from app.models import Tenant

with engine.connect() as conn:
    conn.execute(text("CREATE SCHEMA IF NOT EXISTS concierge"))
    conn.commit()

Base.metadata.create_all(bind=engine)

db = SessionLocal()

companies = [
    {
        "company_name": "ABC Sdn Bhd",
        "telegram_bot_token": "BOT_A",
        "pinecone_namespace": "company_a",
        "litellm_virtual_key": None,
        "status": "active",
    },
    {
        "company_name": "Company B",
        "telegram_bot_token": "BOT_B",
        "pinecone_namespace": "company_b",
        "litellm_virtual_key": None,
        "status": "active",
    },
    {
        "company_name": "Company C",
        "telegram_bot_token": "BOT_C",
        "pinecone_namespace": "company_c",
        "litellm_virtual_key": None,
        "status": "active",
    },
]

for c in companies:
    existing = db.query(Tenant).filter(
        Tenant.telegram_bot_token == c["telegram_bot_token"]
    ).first()
    if not existing:
        db.add(Tenant(**c))

db.commit()
db.close()
