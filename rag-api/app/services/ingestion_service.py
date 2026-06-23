import io
import uuid
from typing import BinaryIO

from pypdf import PdfReader

from app.services.embedding_service import embed_texts


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 100) -> list[str]:
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        start = end - overlap
    return chunks or [text]


def process_pdf(file: BinaryIO, namespace: str) -> int:
    reader = PdfReader(file)
    full_text = ""
    for page in reader.pages:
        full_text += page.extract_text() or ""

    chunks = chunk_text(full_text)
    if not chunks:
        return 0

    embeddings = embed_texts(chunks)

    vectors = []
    for i, (chunk, emb) in enumerate(zip(chunks, embeddings)):
        vectors.append({
            "id": f"{namespace}-{uuid.uuid4()}",
            "values": emb,
            "metadata": {"text": chunk, "chunk_index": i},
        })

    from app.services.pinecone_service import upsert_vectors
    upsert_vectors(vectors, namespace)

    return len(chunks)
