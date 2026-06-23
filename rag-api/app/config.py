from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://concierge:concierge@db:5432/concierge"
    litellm_api_url: str = "http://litellm:4000"
    litellm_master_key: str = "sk-litellm-master"
    pinecone_api_key: str = ""
    pinecone_index_name: str = "knowledge-base"
    pinecone_dimension: int = 384
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/auth/google/callback"
    jwt_secret: str = "change-me-to-a-random-secret"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440
    frontend_url: str = "http://localhost:8080"
    google_admin_emails: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
