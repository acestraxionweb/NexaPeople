import httpx

from app.config import settings


def chat_completion(
    message: str,
    virtual_key: str,
    model: str = "deepseek-v4-flash-free",
    system_prompt: str | None = None,
    user: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> str:
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": message})

    payload = {"model": model, "messages": messages}
    if user:
        payload["user"] = user
    if temperature is not None:
        payload["temperature"] = temperature
    if max_tokens is not None:
        payload["max_tokens"] = max_tokens
    headers = {
        "Authorization": f"Bearer {virtual_key}",
        "Content-Type": "application/json",
    }

    with httpx.Client() as client:
        resp = client.post(
            f"{settings.litellm_api_url}/chat/completions",
            json=payload,
            headers=headers,
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]
