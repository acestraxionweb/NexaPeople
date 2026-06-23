from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://concierge:concierge@db:5432/concierge"
    litellm_api_url: str = "http://litellm:4000"
    litellm_master_key: str = "sk-litellm-master"
    pinecone_api_key: str = ""
    pinecone_index_name: str = "knowledge-base"
    pinecone_dimension: int = 384

    class Config:
        env_file = ".env"


settings = Settings()
