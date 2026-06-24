# Architecture

Multi-tenant AI concierge platform. Each client gets an isolated Telegram bot with RAG on their own documents, centralized LLM billing via LiteLLM, per-user memory, and a dashboard to manage their workspace.

## Architecture Diagram

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Telegram │────▶│  rag-api │────▶│ Pinecone │     │  LiteLLM │
│  Bots    │     │ (FastAPI)│     │  Vector  │     │   Proxy  │
│(polling) │     │          │     │    DB    │     │ (billing)│
└──────────┘     ├──────────┤     └──────────┘     └──────────┘
                 │PostgreSQL│
┌──────────┐     │(tenants, │     ┌──────────┐
│Dashboard │────▶│memories) │     │   Zen    │
│ TanStack │     └──────────┘     │   API    │
│  Start   │                      │   (LLM)  │
└──────────┘                      └──────────┘
```

**Message flow:** User → Telegram → rag-api → tenant lookup → Pinecone query (per-tenant namespace) + memory → system prompt → LiteLLM (per-tenant key) → Zen API → sanitize → reply → extract fact → save memory

---

## Services

All services run as Docker containers defined in `docker-compose.yml`.

| Service | Image | Port | Function |
|---|---|---|---|
| `db` | `postgres:16-alpine` | 5432 | Main PostgreSQL database — stores tenants, tenant users, conversation memories |
| `litellm-db` | `postgres:16-alpine` | — | LiteLLM's own PostgreSQL — stores spend logs, virtual keys, model configs |
| `litellm` | `ghcr.io/berriai/litellm:main-latest` | 4001 | LLM proxy — routes upstream LLM calls with per-tenant virtual key auth, cost tracking, rate limiting |
| `rag-api` | custom (`./rag-api/Dockerfile`) | 8000 | FastAPI backend — all business logic: RAG ingestion, chat completion, auth, admin APIs |
| `telegram-bot-a` | custom (`./telegram/Dockerfile`) | — | Telegram polling bot instance A (horizontally scaled) |
| `telegram-bot-b` | custom (`./telegram/Dockerfile`) | — | Telegram polling bot instance B |
| `telegram-bot-c` | custom (`./telegram/Dockerfile`) | — | Telegram polling bot instance C |
| `dashboard` | custom (`./tenantai-hub/Dockerfile`) | 8080 | TanStack Start SPA — admin & tenant dashboard |

Three separate polling bot containers run in parallel for throughput. Each uses a different `BOT_TOKEN` (configured via `.env`). All three call the same `rag-api` endpoint.

---

## Backend Modules (rag-api)

Python / FastAPI application.

### App Core

| File | Function |
|---|---|
| `main.py` | FastAPI app entry point, CORS middleware, router registration |
| `config.py` | Environment configuration via pydantic-settings |
| `database.py` | SQLAlchemy engine and session factory |
| `models.py` | ORM models: `Tenant`, `Memory`, `TenantUser` |
| `migrate.py` | Schema migration script |
| `seed.py` | Seed initial admin user and default tenant |
| `seed_litellm.py` | Generate LiteLLM virtual keys for tenants |

### Services

| File | Function |
|---|---|
| `litellm_service.py` | `chat_completion()` — sends user message to LiteLLM proxy and returns the LLM reply |
| `litellm_admin_service.py` | Queries LiteLLM spend logs, manages virtual keys (generate, info, spend) |
| `services/embedding_service.py` | `embed_texts()` — batch text embedding via fastembed (`BAAI/bge-small-en-v1.5`, 384d) |
| `services/pinecone_service.py` | `query_vectors()` / `upsert_vectors()` — Pinecone index operations |
| `services/ingestion_service.py` | PDF text extraction → word-based chunking (500 words, 100 overlap) → embed → Pinecone upsert |
| `services/memory_service.py` | Per-user conversation history: `get_memories()` / `add_conversation_turn()` |
| `services/tenant_service.py` | `get_tenant()` — tenant lookup by Telegram bot token |
| `services/sanitize.py` | Strips HTML tags and script blocks from LLM replies before sending to Telegram |

### API Routers

| Router | Endpoints | Function |
|---|---|---|
| `routers/auth.py` | `GET /auth/google/login`, `GET /auth/google/callback`, `GET /auth/me` | Google OAuth sign-in, JWT issuance |
| `routers/telegram.py` | `POST /webhook/telegram` | Chat endpoint used by polling bots |
| `routers/telegram_webhook.py` | `POST /webhook/telegram/{bot_token}` | Telegram webhook endpoint (alternative to polling) |
| `routers/documents.py` | `POST /documents/upload` | Upload PDF for RAG ingestion |
| `routers/dashboard_api.py` | `GET/PUT /api/tenant/*`, `GET/PUT /api/admin/*` | Tenant workspace/config, admin provisioning, global spend |

---

## Telegram Bot

**File:** `telegram/bot.py`

| Library | Function |
|---|---|
| `python-telegram-bot` | Bot framework with long-polling (`Application.run_polling()`) |
| `httpx` (async) | HTTP client to call `rag-api` `/webhook/telegram` |

- Listens for text messages and `/start` commands
- Forwards every message to the RAG API with `bot_token`, `message`, and `user_id` (Telegram chat ID)
- Sanitizes the LLM reply (markdown → HTML) before sending back to Telegram

---

## Dashboard Pages (tenantai-hub)

TanStack Start / React SPA styled with shadcn/ui + Tailwind.

| Route | Function |
|---|---|
| `/login` | Google Sign-In authentication |
| `/workspace` | Tenant workspace settings (company name, timezone, branding) |
| `/chatbot` | Chatbot configuration (system prompt, model, temperature, max tokens) |
| `/documents` | Upload and manage knowledge base PDFs |
| `/users` | Manage tenant users |
| `/logs` | View LLM usage and cost logs from LiteLLM |
| `/admin/tenants` | (Admin only) All tenants, provisioning new tenants |
| `/admin/logs` | (Admin only) Global LLM spend across all tenants |
| `/admin/settings` | (Admin only) System configuration |

---

## External / SaaS Dependencies

| Service | Purpose |
|---|---|
| **Pinecone** | Managed vector database — single index with per-tenant namespaces for document embeddings |
| **Zen API** (`opencode.ai/zen/v1`) | Upstream LLM provider (OpenAI-compatible chat completions & embeddings) |
| **Google OAuth** | Dashboard user authentication via Google Sign-In |
| **Telegram** (`api.telegram.org`) | Chat platform — users send messages to the bot |

---

## Tenant Isolation

| Layer | Mechanism |
|---|---|
| RAG | Pinecone namespace per tenant |
| Memory | DB queries filtered by `tenant_id + user_id` |
| Billing | LiteLLM virtual key per tenant |
| Bot | Bot token → tenant lookup at request time |
| Auth | Tenant-scoped JWT, no cross-tenant API access |
