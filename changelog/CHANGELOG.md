# Changelog

## 2026-06-23

### Authentication
- Google Sign-In OAuth flow (`/auth/google/login`, `/auth/google/callback`, `/auth/me`)
- JWT-based auth with `python-jose[cryptography]`
- Middleware on all tenant and admin API endpoints
- Admin role via `GOOGLE_ADMIN_EMAILS` env var
- Tenant users provisioned via `adminEmail` (unknown emails rejected)
- Role-based sidebar and views (admin vs tenant)

### Dashboard
- Login page with Google Sign-In button and token capture
- AuthContext with JWT persistence in localStorage
- API client sending `Authorization: Bearer <JWT>` on all requests
- Usage page with role-split views (admin → combined, tenant → own)
- Admin overview with real request/token counts from LiteLLM spend logs
- Tokens column in admin tenants table

### Mobile Responsiveness
- Hamburger menu button visible on mobile
- Sheet-based navigation drawer with same sidebar links
- Tables wrapped in `overflow-x-auto` for horizontal scroll

### Remote Access
- Tailscale Serve HTTPS support for dashboard and API
- `VITE_CLIENT_API_URL` env var for browser-side API URL
- Configurable `GOOGLE_REDIRECT_URI` and `FRONTEND_URL`
- `server.allowedHosts: true` in Vite config

### Infrastructure
- Docker Compose with 8 services
- Telegram bot polling container per token (A, B, C)
- LiteLLM proxy with per-tenant virtual keys
- Multi-tenant RAG with Pinecone namespace isolation
- Memory system with fact extraction, dedup, and pruning
- CORS and sanitize middleware for bot replies

### Access Control
- Unknown Google emails redirected with `not_authorized` error
- Only `GOOGLE_ADMIN_EMAILS` or pre-provisioned `tenant_users` can sign in
- No cross-tenant data leakage in RAG, memories, or billing
