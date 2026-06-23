from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, Base
from app.migrate import run as run_migrations
from app.routers import telegram, documents, dashboard_api, admin_provision, telegram_webhook


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    run_migrations()
    yield


app = FastAPI(title="AI Concierge RAG API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(telegram.router)
app.include_router(documents.router)
app.include_router(dashboard_api.router)
app.include_router(admin_provision.router)
app.include_router(telegram_webhook.router)


@app.get("/health")
def health():
    return {"status": "ok"}
