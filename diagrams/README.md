# NexaPeople — Diagrams

Architecture and design diagrams for the AI Concierge platform.

## Format Guide

| Format | Tool | How to Render |
|--------|------|---------------|
| PlantUML (`.puml`) | VS Code: [PlantUML extension](https://marketplace.visualstudio.com/items?itemName=jebbs.plantuml) | `Alt+D` or right-click → Preview |
| PlantUML (`.puml`) | CLI | `java -jar plantuml.jar <file>` |
| DrawIO (`.drawio`) | VS Code: [Draw.io Integration](https://marketplace.visualstudio.com/items?itemName=hediet.vscode-drawio) | Open `.drawio` file |
| DrawIO (`.drawio`) | Web | [app.diagrams.net](https://app.diagrams.net) |
| Mermaid | GitHub | Renders inline in `.md` files |

## Diagram Catalog

### C4 Model (PlantUML)

| File | Level | Scope |
|------|-------|-------|
| `c4_context.puml` | L1 (System Context) | NexaPeople system, users, external dependencies (Telegram, Google, Pinecone, Zen API) |
| `c4_container.puml` | L2 (Container) | 8 Docker containers: db, litellm-db, litellm, rag-api, telegram-bot-{a,b,c}, dashboard |
| `c4_component_ragapi.puml` | L3 (Component) | rag-api internals: routers, services, ORM, LiteLLM client |
| `c4_component_dashboard.puml` | L3 (Component) | Dashboard SPA: pages, hooks, API client, auth context |

### Behaviour (PlantUML)

| File | Description |
|------|-------------|
| `sequence_message.puml` | End-to-end Telegram message flow: user → bot → rag-api → Pinecone → memory → LiteLLM → Zen → reply |
| `sequence_auth.puml` | Google OAuth → JWT → dashboard session flow |
| `sequence_ingestion.puml` | PDF upload → chunk → embed → Pinecone upsert flow |
| `use_case.puml` | Actors: Telegram user, Tenant admin, Super admin — and their goals |
| `state_tenant.puml` | Tenant lifecycle: provision → active → suspended → deleted |

### Data (PlantUML)

| File | Description |
|------|-------------|
| `er_diagram.puml` | ER diagram: Tenant, Memory, TenantUser tables and their relationships |

### Deployment (DrawIO)

| File | Description |
|------|-------------|
| `deployment.drawio` | Docker Compose deployment topology: 8 containers, ports, networks, volumes, Tailscale |

### Data Flow (Mermaid)

Embedded in `ARCHITECTURE.md` — a DFD showing how data moves across all services.

## Updating

Edit the `.puml` / `.drawio` file directly and re-render. All diagrams are designed to be regenerated from source — no binary assets.
