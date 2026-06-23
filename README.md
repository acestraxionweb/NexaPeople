# AI Concierge — NexaPeople

Multi-tenant AI concierge SaaS. Each client gets an isolated Telegram bot with RAG on their own documents, centralized LLM billing via LiteLLM, and per-user memory.

## Stack

| Layer | Tool |
|---|---|
| Backend | FastAPI (rag-api) |
| Vector DB | Pinecone (single index, per-tenant namespace) |
| Embeddings | fastembed BAAI/bge-small-en-v1.5 (384d) |
| LLM Proxy | LiteLLM (per-tenant virtual keys) |
| LLM | Zen API (OpenAI-compatible) |
| DB | PostgreSQL (tenants, memories) |
| Bots | Polling containers or Telegram webhooks |
| Dashboard | TanStack Start, shadcn/ui, Recharts |

## Quick Start

```bash
cp .env.example .env   # fill in secrets
docker compose up -d
open http://localhost:8080
```

## Message Flow

```
User → Telegram bot → rag-api → tenant lookup → Pinecone query (namespace) + memory fetch
→ system prompt (RAG context + memories) → LiteLLM (virtual key) → Zen API → sanitize → reply
→ extract fact → save to memory (max 3 per user) → Telegram
```

## Tenant Isolation

| Layer | How |
|---|---|
| RAG | Pinecone namespace |
| Memory | `memories` table filtered by tenant_id + user_id |
| Billing | LiteLLM virtual key per tenant |
| Bot | Bot token → tenant via DB lookup |

## Provision a Client

**Dashboard**: Admin → Tenants → New Tenant → company name + bot token + plan → get credentials card.

**Webhook** (production): `curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<DOMAIN>/webhook/telegram/<TOKEN>"`

**Polling bot** (dev): add a new `telegram-bot-*` service to docker-compose.yml with the new `BOT_TOKEN_C`.

## Key API Endpoints

| Endpoint | Purpose |
|---|---|
| `POST /webhook/telegram` | Polling bot (JSON: `{bot_token, message, user_id}`) |
| `POST /webhook/telegram/{token}` | Telegram webhook |
| `POST /documents/upload` | Upload PDF (multipart) |
| `GET /api/tenant/{summary,usage,workspace,chatbot,keys,logs,knowledge,conversations}` | Tenant data |
| `PUT /api/tenant/{workspace,chatbot}` | Update tenant config |
| `GET|POST /api/admin/{tenants,health,audit,provision}` | Admin operations |

## Project Tree

```
├── docker-compose.yml
├── rag-api/app/          # FastAPI: routers/, services/, models.py, migrate.py
├── telegram/bot.py       # Polling bot (one per token)
└── tenantai-hub/         # Dashboard (TanStack Start)
```

## Troubleshooting

**Bot silent?** `docker compose ps | grep telegram` — is the polling container running? Does the tenant exist (`/api/admin/tenants`)?

**"I don't have that information"?** Upload a PDF via Dashboard → Chatbot Config → Knowledge base.

**Markdown showing as raw text?** Sanitizer in `rag-api/app/services/sanitize.py` converts `**bold**` → `<b>bold</b>`.

**Memory not saving?** Check `concierge.memories` table — `docker compose exec rag-api python3 -c "from app.database import SessionLocal; s=SessionLocal(); print(s.execute('SELECT count(*) FROM concierge.memories').scalar())"`
