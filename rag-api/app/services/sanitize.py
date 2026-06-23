import re


def sanitize_reply(text: str) -> str:
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<i>\1</i>", text)
    text = re.sub(r"__([^_]+)__", r"<u>\1</u>", text)
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    return text
