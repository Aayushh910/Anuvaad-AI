
import json
from pathlib import Path
from uuid import uuid5, NAMESPACE_URL

from qdrant_client import QdrantClient, models
from sentence_transformers import SentenceTransformer

BASE_DIR = Path(__file__).resolve().parents[2]
CHUNKS_DIR = BASE_DIR / "storage" / "chunks"
QDRANT_DIR = BASE_DIR / "storage" / "qdrant"

COLLECTION_NAME = "pdf_chunks"
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

QDRANT_DIR.mkdir(parents=True, exist_ok=True)

client = QdrantClient(path=str(QDRANT_DIR))
model = SentenceTransformer(EMBEDDING_MODEL)

VECTOR_SIZE = model.get_sentence_embedding_dimension()

if not client.collection_exists(COLLECTION_NAME):
    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=models.VectorParams(
            size=VECTOR_SIZE,
            distance=models.Distance.COSINE,
        ),
    )


def index_document(document_id: str) -> dict:
    chunks_path = CHUNKS_DIR / f"{document_id}.json"

    if not chunks_path.exists():
        raise FileNotFoundError(f"Chunks not found for {document_id}")

    chunks = json.loads(chunks_path.read_text(encoding="utf-8"))

    if not chunks:
        raise ValueError("No chunks found to index.")

    texts = [chunk["text"] for chunk in chunks]
    embeddings = model.encode(
        texts,
        normalize_embeddings=True,
        show_progress_bar=True,
    )

    points = []

    for chunk, embedding in zip(chunks, embeddings):
        point_id = str(
            uuid5(NAMESPACE_URL, chunk["chunk_id"])
        )

        points.append(
            models.PointStruct(
                id=point_id,
                vector=embedding.tolist(),
                payload={
                    "chunk_id": chunk["chunk_id"],
                    "document_id": chunk["document_id"],
                    "chunk_index": chunk["chunk_index"],
                    "text": chunk["text"],
                    "metadata": chunk["metadata"],
                },
            )
        )

    client.upsert(
        collection_name=COLLECTION_NAME,
        points=points,
        wait=True,
    )

    return {
        "document_id": document_id,
        "indexed_chunks": len(points),
        "collection": COLLECTION_NAME,
        "embedding_model": EMBEDDING_MODEL,
        "vector_dimensions": VECTOR_SIZE,
    }
