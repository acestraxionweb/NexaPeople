import asyncio
import logging
import os
import re

import httpx
from telegram import Update
from telegram.error import TimedOut, RetryAfter
from telegram.ext import Application, MessageHandler, CommandHandler, filters, ContextTypes

def _sanitize_reply(text: str) -> str:
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<i>\1</i>", text)
    text = re.sub(r"__([^_]+)__", r"<u>\1</u>", text)
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    return text

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

RAG_API_URL = os.environ.get("RAG_API_URL", "http://rag-api:8000")
BOT_TOKEN = os.environ["BOT_TOKEN"]


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "<b>Hey there! 👋</b>\n\n"
        "I'm the company concierge. Ask me anything about our "
        "products, services, policies, or how things work around here.",
        parse_mode="HTML",
    )


async def safe_reply(update: Update, text: str, max_retries: int = 3):
    for attempt in range(max_retries):
        try:
            await update.message.reply_text(text, parse_mode="HTML", read_timeout=30, write_timeout=30)
            return
        except TimedOut:
            logger.warning(f"Telegram reply timed out (attempt {attempt + 1}/{max_retries}), retrying...")
            await asyncio.sleep(2 ** attempt)
        except RetryAfter as e:
            logger.warning(f"Telegram rate-limited, waiting {e.retry_after}s...")
            await asyncio.sleep(e.retry_after)
        except Exception as e:
            logger.error(f"Telegram reply failed: {e}")
            return
    logger.error("All retries exhausted, could not deliver reply")


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return

    user_msg = update.message.text
    chat_id = update.message.chat_id
    logger.info(f"Message from {chat_id}: {user_msg[:50]}...")

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{RAG_API_URL}/webhook/telegram",
                json={"bot_token": BOT_TOKEN, "message": user_msg, "user_id": str(chat_id)},
                timeout=120,
            )
        except httpx.TimeoutException:
            logger.error("RAG API request timed out")
            await safe_reply(update, "Sorry, the request timed out. Please try again.")
            return
        except Exception as e:
            logger.error(f"RAG API request failed: {e}")
            await safe_reply(update, "Sorry, something went wrong. Please try again later.")
            return

        if resp.status_code != 200:
            logger.error(f"RAG API returned {resp.status_code}: {resp.text[:200]}")
            await safe_reply(update, "Sorry, something went wrong. Please try again later.")
            return

        data = resp.json()
        reply = _sanitize_reply(data["reply"])
        logger.info(f"Reply ({len(reply)} chars): {reply[:80]}...")
        await safe_reply(update, reply)


def main():
    logger.info("Starting bot...")
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    logger.info("Bot started, polling...")
    app.run_polling(allowed_updates=[Update.MESSAGE])


if __name__ == "__main__":
    main()
