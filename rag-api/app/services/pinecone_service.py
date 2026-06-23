from pinecone import Pinecone, ServerlessSpec

from app.config import settings

pc = Pinecone(api_key=settings.pinecone_api_key)

INDEX_NAME = settings.pinecone_index_name

def _ensure_index():
    if INDEX_NAME not in pc.list_indexes().names():
        pc.create_index(
            name=INDEX_NAME,
            dimension=settings.pinecone_dimension,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )


def upsert_vectors(vectors: list[dict], namespace: str):
    _ensure_index()
    index = pc.Index(INDEX_NAME)
    index.upsert(vectors=vectors, namespace=namespace)


def query_vectors(vector: list[float], namespace: str, top_k: int = 5):
    _ensure_index()
    index = pc.Index(INDEX_NAME)
    return index.query(
        vector=vector,
        namespace=namespace,
        top_k=top_k,
        include_metadata=True,
    )


def describe_index_stats():
    _ensure_index()
    index = pc.Index(INDEX_NAME)
    return index.describe_index_stats()
