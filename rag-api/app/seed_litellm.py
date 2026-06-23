import httpx
from app.config import settings
from app.database import SessionLocal
from app.models import Tenant

LITELLM_ADMIN_KEY = settings.litellm_master_key
LITELLM_URL = settings.litellm_api_url


def create_virtual_key(tenant_name: str) -> str | None:
    payload = {
        "models": ["deepseek-v4-flash-free", "mimo-v2.5-free", "north-mini-code-free", "nemotron-3-ultra-free", "big-pickle"],
        "metadata": {"tenant": tenant_name},
        "max_budget": 100.0,
    }
    headers = {
        "Authorization": f"Bearer {LITELLM_ADMIN_KEY}",
        "Content-Type": "application/json",
    }
    with httpx.Client() as client:
        resp = client.post(
            f"{LITELLM_URL}/key/generate",
            json=payload,
            headers=headers,
            timeout=15,
        )
        if resp.status_code != 200:
            print(f"  FAILED ({resp.status_code}): {resp.text}")
            return None
        data = resp.json()
        return data["key"]


def main():
    db = SessionLocal()
    tenants = db.query(Tenant).filter(Tenant.status == "active").all()

    for t in tenants:
        if t.litellm_virtual_key:
            print(f"{t.company_name}: already has key, skipping")
            continue

        print(f"{t.company_name}: creating virtual key...")
        key = create_virtual_key(t.pinecone_namespace or t.company_name)
        if key:
            t.litellm_virtual_key = key
            db.commit()
            print(f"  -> key saved: {key[:20]}...")
        else:
            print(f"  -> failed to create key")

    db.close()


if __name__ == "__main__":
    main()
