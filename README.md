# NexaPeople — AI Concierge

Multi-tenant AI concierge platform. Each client gets an isolated Telegram bot with RAG on their own documents, centralized LLM billing via LiteLLM, per-user memory, and a dashboard to manage their workspace.

## Architecture

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

## Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (Python) |
| Vector DB | Pinecone (single index, namespaced per tenant) |
| Embeddings | fastembed `BAAI/bge-small-en-v1.5` (384d) |
| LLM Proxy | LiteLLM with per-tenant virtual keys |
| LLM | Zen API (OpenAI-compatible) |
| Database | PostgreSQL (tenants, users, memories) |
| Chat bots | Telegram (polling or webhook) |
| Dashboard | TanStack Start, shadcn/ui, Recharts |
| Auth | Google Sign-In + JWT |

## Quick Start

```bash
cp .env.example .env    # fill in secrets
docker compose up -d
open http://localhost:8080
```

### Required secrets

| Variable | Description |
|---|---|
| `OPENCODE_ZEN_API_KEY` | LLM provider API key |
| `PINECONE_API_KEY` | Pinecone vector database key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_ADMIN_EMAILS` | Comma-separated admin emails |

## Tenant Isolation

| Layer | Mechanism |
|---|---|
| RAG | Pinecone namespace per tenant |
| Memory | DB queries filtered by `tenant_id + user_id` |
| Billing | LiteLLM virtual key per tenant |
| Bot | Bot token → tenant lookup at request time |
| Auth | Tenant-scoped JWT, no cross-tenant API access |

## Provisioning a Client

**Via dashboard:** Admin → Tenants → New Tenant → fill in company name, bot token, admin email, plan.

**Via API:**
```bash
curl -X POST http://localhost:8000/api/admin/provision \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Acme Corp","telegramBotToken":"123:ABC","plan":"starter","adminEmail":"admin@acme.com"}'
```

After provisioning, add a polling bot container for the new token (see `telegram-bot-c` in `docker-compose.yml`).

## Dashboard

Accessible at `http://localhost:8080`. Sign in with Google.

- **Tenant users** see their workspace overview, API keys, usage, chatbot config, logs, and settings.
- **Admins** additionally see all tenants, global usage, system health, and audit logs.

## API Overview

| Endpoint | Purpose |
|---|---|
| `POST /webhook/telegram` | Polling bot endpoint |
| `POST /webhook/telegram/{token}` | Telegram webhook |
| `POST /documents/upload` | Upload PDF to knowledge base |
| `GET /auth/me` | Current user info |
| `GET /api/tenant/*` | Tenant-scoped data |
| `PUT /api/tenant/{workspace,chatbot}` | Update tenant config |
| `GET /api/admin/*` | Admin operations |
| `POST /api/admin/provision` | Create new tenant |

## Remote Access via Tailscale

Serve the dashboard (port 8080) and API (port 8000) over HTTPS on your Tailscale domain:

```bash
tailscale serve --bg --https 443 localhost:8080    # Dashboard
tailscale serve --bg --https 8443 localhost:8000   # RAG API
```

Make them publicly accessible (optional):
```bash
tailscale funnel --bg --https 443 localhost:8080   # Public dashboard
tailscale funnel --bg --https 8443 localhost:8000  # Public API
```

### Switching between localhost and Tailscale

Update `.env` and restart the relevant containers:

**Tailscale mode (remote):**
```env
VITE_CLIENT_API_URL=https://<machine>.ts.net:8443
FRONTEND_URL=https://<machine>.ts.net
GOOGLE_REDIRECT_URI=https://<machine>.ts.net:8443/auth/google/callback
```

**Localhost mode:**
```env
VITE_CLIENT_API_URL=http://localhost:8000
FRONTEND_URL=http://localhost:8080
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
```

Then apply:
```bash
docker compose up -d --force-recreate dashboard rag-api
```

> **Note:** OAuth redirects are now dynamic — the frontend passes its current origin through the OAuth flow, so only `VITE_CLIENT_API_URL` strictly needs to change. `FRONTEND_URL` and `GOOGLE_REDIRECT_URI` are fallbacks if the dynamic values are unavailable.

Register **all** callback URLs in Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID → **Authorized redirect URIs**:
- `http://localhost:8000/auth/google/callback`
- `https://<machine>.ts.net:8443/auth/google/callback`

## Project Structure

```
├── docker-compose.yml       # All services
├── rag-api/                 # FastAPI backend
│   └── app/
│       ├── routers/         # API endpoints
│       ├── services/        # RAG, memory, embeddings, sanitize
│       ├── models.py        # DB models
│       ├── migrate.py       # Schema migration
│       └── config.py        # Environment config
├── telegram/                # Polling bot
│   └── bot.py
├── tenantai-hub/            # Dashboard
│   └── src/
│       ├── routes/          # Page components
│       ├── components/      # UI components
│       └── lib/             # API client, auth context
└── changelog/
```

## License

MIT
