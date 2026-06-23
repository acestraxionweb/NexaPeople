from app.database import SessionLocal
from app.models import Tenant


def get_tenant(bot_token: str):
    db = SessionLocal()
    try:
        return (
            db.query(Tenant)
            .filter(
                Tenant.telegram_bot_token == bot_token,
                Tenant.status == "active"
            )
            .first()
        )
    finally:
        db.close()
