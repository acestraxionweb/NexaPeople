# AI Concierge — NexaPeople

Multi-tenant AI concierge SaaS. Each client gets an isolated Telegram bot with RAG on their own documents, centralized LLM billing via LiteLLM, and per-user memory.

## Architecture

```
├── rag-api/          # FastAPI backend (RAG pipeline, memory, LLM proxy)
├── telegram/         # Telegram polling bot(s)
├── tenantai-hub/     # Admin dashboard (TanStack Start + Vite)
└── docker-compose.yml
```

## Quick Start

```bash
# 1. Set secrets
cp .env.example .env
# Edit .env with your API keys (Pinecone, LiteLLM, Telegram tokens)

# 2. Start all services
docker compose up -d

# 3. Open dashboard
open http://localhost:8080
```

## Services

| Service | Port | Description |
|---|---|---|
| `db` | 5432 | PostgreSQL (tenant data, memories) |
| `litellm-db` | — | PostgreSQL (LiteLLM usage logs) |
| `litellm` | 4001 | LLM proxy with virtual key billing |
| `rag-api` | 8000 | FastAPI — RAG, webhooks, dashboard API |
| `telegram-bot-*` | — | One polling container per bot token |
| `dashboard` | 8080 | Admin panel (TanStack Start) |

## Provisioning a New Tenant

1. Admin → Tenants → New Tenant
2. Enter company name + Telegram bot token + plan
3. Client uploads PDFs via Dashboard → Chatbot Config
4. Client talks to their Telegram bot — isolated RAG + memory

## Environment Variables

See `.env.example` for all required secrets.

## Key Features

- **Per-tenant RAG**: Single Pinecone index, namespaced per client
- **Per-user memory**: 3 facts per (tenant, user), stored in PostgreSQL
- **LiteLLM billing**: Virtual keys per tenant, usage tracking via LiteLLM proxy
- **Multi-bot**: One polling container per bot token, or use Telegram webhooks
- **HTML sanitization**: Markdown → HTML conversion for Telegram messages
