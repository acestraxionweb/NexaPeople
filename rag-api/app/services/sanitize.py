import re


def sanitize_reply(text: str) -> str:
    if not text:
        return text

    # Strip markdown headers (### Title → Title)
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)

    # Strip horizontal rules (---, ***, ___)
    text = re.sub(r"^[-*_]{3,}\s*$", "", text, flags=re.MULTILINE)

    # Strip markdown bullet markers (* , - , +) and numbered list markers (1. )
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*\d+\.\s+", "", text, flags=re.MULTILINE)

    # Convert **bold** to <b>
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)

    # Convert *italic* to <i> (opening * not preceded by word char; closing * not followed by word char or *)
    text = re.sub(r"(?<!\w)\*(?!\*)(.+?)\*(?![\*\w])", r"<i>\1</i>", text)

    # Convert _italic_ to <i> (same boundary rules)
    text = re.sub(r"(?<!\w)_(?!_)(.+?)_(?![_\w])", r"<i>\1</i>", text)

    # Convert __underline__ to <u>
    text = re.sub(r"__([^_]+)__", r"<u>\1</u>", text)

    # Convert ~~strikethrough~~ to <s>
    text = re.sub(r"~~(.+?)~~", r"<s>\1</s>", text)

    # Convert triple-backtick code block to <code> block (before inline code)
    text = re.sub(r"```\w*\n?(.*?)```", r"<code>\1</code>", text, flags=re.DOTALL)

    # Convert `inline code` to <code>
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)

    # Convert [text](url) to plain text
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)

    # Strip remaining unmatched bare markdown characters: * _ ~ `
    text = re.sub(r"(?<=\s)([*_~`])(?=\s)", r"", text)
    text = re.sub(r"(?<=\s)([*_~`])(?!\w)", r"", text)
    text = re.sub(r"(?<!\w)([*_~`])(?=\s)", r"", text)

    # Collapse 3+ consecutive blank lines into one
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()
