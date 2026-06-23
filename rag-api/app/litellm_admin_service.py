import hashlib

import httpx

from app.config import settings


def _litellm_get(path: str) -> dict | list:
    with httpx.Client() as client:
        resp = client.get(
            f"{settings.litellm_api_url}{path}",
            headers={"Authorization": f"Bearer {settings.litellm_master_key}"},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()


def key_hash(virtual_key: str) -> str:
    return hashlib.sha256(virtual_key.encode()).hexdigest()


def global_spend():
    return _litellm_get("/global/spend")


def spend_keys():
    return _litellm_get("/spend/keys")


def spend_logs(api_key_hash: str | None = None, start_date: str | None = None, end_date: str | None = None):
    params = {}
    if api_key_hash:
        params["api_key"] = api_key_hash
    if start_date:
        params["start_date"] = start_date
    if end_date:
        params["end_date"] = end_date
    qs = "&".join(f"{k}={v}" for k, v in params.items())
    return _litellm_get(f"/spend/logs?{qs}" if qs else "/spend/logs")


def key_info(virtual_key: str):
    return _litellm_get(f"/key/info?key={virtual_key}")["info"]


def model_info():
    return _litellm_get("/model/info")


def generate_key(tenant_namespace: str, max_budget: float = 100.0) -> str | None:
    payload = {
        "models": ["deepseek-v4-flash-free", "mimo-v2.5-free", "north-mini-code-free", "nemotron-3-ultra-free", "big-pickle"],
        "metadata": {"tenant": tenant_namespace},
        "max_budget": max_budget,
    }
    with httpx.Client() as client:
        resp = client.post(
            f"{settings.litellm_api_url}/key/generate",
            json=payload,
            headers={"Authorization": f"Bearer {settings.litellm_master_key}", "Content-Type": "application/json"},
            timeout=15,
        )
        if resp.status_code != 200:
            return None
        return resp.json()["key"]
