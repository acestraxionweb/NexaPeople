# AI Concierge — NexaPeople

Multi-tenant AI concierge SaaS. Each client gets an isolated Telegram bot with RAG on their own documents, centralized LLM billing via LiteLLM, and per-user memory (up to 3 facts per user).

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Telegram   │────▶│   rag-api    │────▶│  Pinecone   │
│  Bot Poller │     │  (FastAPI)   │     │  (per-tenant │
│             │     │              │     │  namespace)  │
└─────────────┘     │  ┌─────────┐ │     └─────────────┘
                    │  │ Memory  │ │
┌─────────────┐     │  │ (Post-  │ │     ┌─────────────┐
│  Telegram   │────▶│  │ greSQL) │ │────▶│  LiteLLM    │
│  Webhook    │     │  └─────────┘ │     │  (LLM proxy)│
└─────────────┘     └──────────────┘     └─────────────┘
                           │                      │
                           ▼                      ▼
                    ┌──────────────┐     ┌──────────────┐
                    │  Dashboard   │     │   Zen API    │
                    │  (TanStack)  │     │  (LLM model) │
                    └──────────────┘     └──────────────┘

PostgreSQL (concierge) ─── Tenants, Memories
PostgreSQL (litellm)   ─── Usage logs, virtual keys
```

### Message flow

```
User sends message to Telegram bot
  → Polling bot OR Telegram webhook sends to rag-api
  → rag-api looks up tenant by bot_token
  → Queries Pinecone (isolated by namespace) for RAG context
  → Loads user's memories (latest 3 facts for this tenant+user)
  → Builds system prompt with context + memories
  → Sends to LiteLLM proxy with tenant's virtual key
  → LiteLLM routes to Zen API (OpenAI-compatible)
  → Reply sanitized (markdown → HTML) and returned
  → Extract one fact from conversation, save to memories (max 3)
  → Reply sent back to Telegram
```

## Prerequisites

- Docker & Docker Compose v2
- A Pinecone account with an index named `knowledge-base` (384-dim, cosine, serverless us-east-1) — auto-created if missing
- A Zen API key (OpenAI-compatible endpoint)
- Telegram bot tokens from [@BotFather](https://t.me/BotFather) — one per client

## Setup

```bash
# 1. Clone and enter the project
cd NexaPeople

# 2. Set secrets
cp .env.example .env
```

### Environment Variables

Edit `.env` with your credentials:

| Variable | Required | Description |
|---|---|---|
| `OPENCODE_ZEN_API_KEY` | Yes | Zen API key for LLM access |
| `PINECONE_API_KEY` | Yes | Pinecone API key |
| `BOT_TOKEN_A` | Yes (per bot) | Telegram bot token for first client |
| `BOT_TOKEN_B` | Per bot | Telegram bot token for second client |
| `LITELLM_MASTER_KEY` | No | Defaults to `sk-litellm-master` |
| `PINECONE_INDEX_NAME` | No | Defaults to `knowledge-base` |

```bash
# 3. Start all services
docker compose up -d

# 4. Open the dashboard
open http://localhost:8080
```

## Services

| Service | Port | Description | Depends On |
|---|---|---|---|
| `db` | 5432 | PostgreSQL — tenants, memories | — |
| `litellm-db` | — | PostgreSQL — LiteLLM usage logs | — |
| `litellm` | 4001 | LLM proxy with per-tenant virtual keys | `litellm-db` |
| `rag-api` | 8000 | FastAPI — RAG, memory, webhooks, dashboard API | `db`, `litellm` |
| `telegram-bot-a` | — | Polling bot for client A | `rag-api` |
| `telegram-bot-b` | — | Polling bot for client B | `rag-api` |
| `dashboard` | 8080 | Admin panel (TanStack Start + Vite) | `rag-api` |

## Provisioning a New Client

### Via Dashboard

1. Open **Admin** → **Tenants** → **New Tenant**
2. Fill in:
   - **Company name**
   - **Telegram bot token** (from BotFather)
   - **Plan** (starter, etc.)
3. Click **Provision** — creates DB record, Pinecone namespace, LiteLLM virtual key
4. Share credentials with client: tenant ID, namespace, virtual key

### Add a Polling Bot (for local dev)

If the new client needs a polling bot (not webhooks), add to `docker-compose.yml`:

```yaml
  telegram-bot-c:
    build: ./telegram
    environment:
      BOT_TOKEN: ${BOT_TOKEN_C}
      RAG_API_URL: http://rag-api:8000
    depends_on:
      - rag-api
```

Add `BOT_TOKEN_C=your_token` to `.env`, then:

```bash
docker compose up -d telegram-bot-c
```

### Use Webhooks (for production)

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<DOMAIN>/webhook/telegram/<TOKEN>"
```

Each bot gets its own webhook pointing to the same rag-api — no extra containers needed.

## Client Onboarding

1. Open dashboard at `http://localhost:8080`
2. Enter their **bot token** as the API key in Settings
3. Go to **Chatbot Config** → **Knowledge base** → Upload PDFs
4. Documents are chunked, embedded, and stored in their private Pinecone namespace
5. Client talks to their Telegram bot — answers come from their documents only

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/webhook/telegram` | — | Polling bot endpoint (JSON payload with bot_token, message, user_id) |
| `POST` | `/webhook/telegram/{bot_token}` | — | Telegram webhook endpoint (raw Update JSON) |
| `POST` | `/documents/upload` | Bot token (form) | Upload PDF for a tenant |
| `GET` | `/health` | — | Health check |
| `GET` | `/api/admin/tenants` | None | List all tenants (open for prototype) |
| `POST` | `/api/admin/provision` | None | Create a new tenant |
| `GET` | `/api/tenant/knowledge` | `x-api-key: bot_token` | List tenant's vector count |
| `GET` | `/api/tenant/usage` | `x-api-key: bot_token` | LiteLLM spend data |
| `GET` | `/api/tenant/conversations` | `x-api-key: bot_token` | Recent conversations |
| `GET` | `/api/tenant/overview` | `x-api-key: bot_token` | Dashboard summary |

## Architecture Details

### Tenant Isolation

| Layer | Mechanism |
|---|---|
| **RAG** | Single Pinecone index `knowledge-base`, one namespace per tenant |
| **Memory** | PostgreSQL table `memories`, filtered by `tenant_id` + `user_id` |
| **LLM Billing** | One LiteLLM virtual key per tenant, tracked separately |
| **Bot** | Each bot token maps to exactly one tenant via DB lookup |

### Memory System

- Stores up to **3 facts** per (tenant, user)
- Extracted automatically after each reply by a secondary LLM call
- Injected into system prompt on every turn: "What I know about this person: ..."
- Deduped by exact match, oldest pruned on insert
- No cross-tenant leakage — every query is scoped by `tenant_id`

### HTML Sanitization

The LLM occasionally outputs markdown (`**bold**`) instead of HTML (`<b>bold</b>`). A `sanitize_reply()` function converts markdown to HTML before the reply reaches Telegram (which uses `parse_mode=HTML`).

## Deployment Considerations

- **Webhooks**: For production, stop polling containers and use Telegram webhooks with a public HTTPS domain
- **Database backups**: Both PostgreSQL volumes (`pgdata`, `litellm-pgdata`) are named volumes — back them up regularly
- **LLM rate limits**: Each bot token is rate-limited to 5 requests per 10 seconds
- **Pinecone capacity**: All tenants share one index. Monitor `describe_index_stats()` for vector count and plan index sizing
- **Dashboard auth**: The prototype uses bot tokens for API auth. Add proper SSO/JWT for production

## Troubleshooting

**Bot doesn't respond:**
- Is the polling container running? `docker compose ps | grep telegram`
- Does the tenant exist? Check `http://localhost:8000/api/admin/tenants`
- Check logs: `docker compose logs telegram-bot-a`

**Bot says "I don't have that information":**
- Upload a PDF via Dashboard → Chatbot Config → Knowledge base
- Verify vectors exist: `docker compose exec rag-api python3 -c "from app.services.pinecone_service import describe_index_stats; print(describe_index_stats())"`

**Markdown instead of bold text in Telegram:**
- The sanitizer should catch `**bold**` → `<b>bold</b>`. If not, check `app/services/sanitize.py`

## Project Structure

```
├── docker-compose.yml       # All 7+ services
├── .env.example             # Template for secrets
├── .gitignore
├── README.md
├── rag-api/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── litellm_config.yaml  # LiteLLM model routing config
│   └── app/
│       ├── main.py          # FastAPI entry point + CORS
│       ├── config.py        # Settings from env
│       ├── database.py      # SQLAlchemy engine + session
│       ├── models.py        # Tenant, Memory ORM models
│       ├── migrate.py       # Auto-migrations on startup
│       ├── litellm_service.py        # Chat completion via LiteLLM
│       ├── litellm_admin_service.py  # Admin API (spend, keys, logs)
│       ├── seed.py          # DB seed data
│       ├── seed_litellm.py  # LiteLLM initial setup
│       ├── routers/
│       │   ├── telegram.py           # Polling bot endpoint + prompt
│       │   ├── telegram_webhook.py   # Webhook endpoint
│       │   ├── documents.py          # PDF upload
│       │   ├── dashboard_api.py      # Admin + tenant API endpoints
│       │   └── admin_provision.py    # Tenant provisioning
│       └── services/
│           ├── embedding_service.py  # BAAI/bge-small-en-v1.5
│           ├── ingestion_service.py  # PDF chunking + embedding
│           ├── memory_service.py     # Get/add/extract memories
│           ├── pinecone_service.py   # Vector upsert/query
│           ├── sanitize.py           # Markdown → HTML
│           └── tenant_service.py     # Lookup tenant by bot token
├── telegram/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── bot.py               # Polling bot (start + handle messages)
│   └── bot_setup.md
└── tenantai-hub/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    └── src/
        ├── lib/api.ts       # All API calls
        ├── lib/app-context.tsx
        └── routes/          # 9 pages (overview, tenants, chatbot, etc.)
```
