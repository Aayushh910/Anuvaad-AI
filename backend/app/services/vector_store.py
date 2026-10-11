import json
from pathlib import Path
from uuid import uuid5, NAMESPACE_URL

from qdrant_client import QdrantClient, models
from sentence_transformers import SentenceTransformer
from qdrant_client.models import Filter, FieldCondition, MatchValue

BASE_DIR = Path(__file__).resolve().parents[2]
CHUNKS_DIR = BASE_DIR / "storage" / "chunks"
QDRANT_DIR = BASE_DIR / "storage" / "qdrant"

COLLECTION_NAME = "pdf_chunks"
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

QDRANT_DIR.mkdir(parents=True, exist_ok=True)

client = QdrantClient(path=str(QDRANT_DIR))
model = SentenceTransformer(EMBEDDING_MODEL)

VECTOR_SIZE = model.get_embedding_dimension()

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


def search_documents(
    query: str,
    limit: int = 5,
    document_id: str | None = None,
) -> list[dict]:
    """Retrieve the most relevant document chunks for a query."""

    if not query.strip():
        raise ValueError("Search query cannot be empty.")

    # Convert the user's question into an embedding.
    query_vector = model.encode(
        query,
        normalize_embeddings=True,
    ).tolist()

    # Optionally restrict search to one PDF.
    query_filter = None
    if document_id:
        query_filter = Filter(
            must=[
                FieldCondition(
                    key="document_id",
                    match=MatchValue(value=document_id),
                )
            ]
        )

    results = client.query_points(
        collection_name=COLLECTION_NAME,
        query=query_vector,
        query_filter=query_filter,
        limit=limit,
        with_payload=True,
    ).points

    return [
        {
            "score": point.score,
            "document_id": point.payload.get("document_id"),
            "chunk_id": point.payload.get("chunk_id"),
            "chunk_index": point.payload.get("chunk_index"),
            "text": point.payload.get("text"),
            "metadata": point.payload.get("metadata", {}),
        }
        for point in results
    ]