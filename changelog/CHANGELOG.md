# Changelog

## 2026-06-23

### Google OAuth + JWT Auth
- Google Sign-In flow (`/auth/google/login`, `/auth/google/callback`, `/auth/me`)
- JWT issue/verify with `python-jose[cryptography]`
- Auth middleware on all `/api/tenant/*` and `/api/admin/*` endpoints
- Admin role via `GOOGLE_ADMIN_EMAILS` env var
- Tenant users provisioned via `adminEmail` field (no auto-create for unknown emails)
- `TenantUser` model + `concierge.tenant_users` table

### Dashboard Login
- Login page with Google Sign-In button, token capture from URL
- `AuthContext` + `AuthGuard` — JWT in localStorage, `/auth/me` on mount
- `request()` API client sends `Authorization: Bearer <JWT>`
- Role-based sidebar/header (admin vs tenant), role switcher removed
- Error display for unauthorized emails (`?error=not_authorized`)

### Usage & Overview
- Admin usage endpoint `/api/admin/usage` + breakdown `/api/admin/usage/breakdown`
- Tenant usage endpoint `/api/tenant/usage`
- Real request/token counts from LiteLLM spend logs (no mock data)
- Split usage page: admin sees combined, tenant sees own
- Tokens column in admin overview tenants table

### Mobile-Responsive Dashboard
- Hamburger menu button in header (visible `md:hidden`)
- Sheet-based navigation drawer sliding from left with same nav links as desktop sidebar
- Shared `NavItem` type + `tenantNav`/`adminNav` exports
- Tables wrapped in `overflow-x-auto` for horizontal scroll on mobile

### Remote Access via Tailscale
- `VITE_CLIENT_API_URL` env var for browser-side API URL (SSR still uses `VITE_API_URL`)
- Login button uses configurable API URL
- Google OAuth redirect URI configurable via `GOOGLE_REDIRECT_URI` env var
- `FRONTEND_URL` configurable via env var
- `server.allowedHosts: true` in Vite config

### Infrastructure
- Docker Compose: db, litellm-db, litellm, rag-api, telegram-bot-{a,b,c}, dashboard
- Telegram bot polling container per token (A, B, C)
- LiteLLM admin proxy with per-tenant virtual keys
- Multi-tenant RAG with Pinecone namespace isolation
- Memory system (`concierge.memories`): extract fact, dedup, prune to 3 per user
- CORS `allow_origins=["*"]`, sanitize middleware for bot replies

### Auth Restrictions
- Unknown Google emails rejected with `not_authorized` error
- Only `GOOGLE_ADMIN_EMAILS` or pre-provisioned `tenant_users` can sign in
