import json
from pathlib import Path

from app.services.vector_store import client, model, COLLECTION_NAME
from qdrant_client import models
from uuid import uuid5, NAMESPACE_URL


BASE_DIR = Path(__file__).resolve().parents[2]
PROCESSED_DIR = BASE_DIR / "storage" / "processed"


def index_document_tables(document_id: str) -> dict:
    """Index extracted PDF tables as searchable text in Qdrant."""

    tables_path = PROCESSED_DIR / f"{document_id}.tables.json"

    if not tables_path.exists():
        raise FileNotFoundError(
            f"Extracted tables not found: {tables_path}"
        )

    tables = json.loads(tables_path.read_text(encoding="utf-8"))

    if not tables:
        return {
            "document_id": document_id,
            "indexed_tables": 0,
            "collection": COLLECTION_NAME,
        }

    texts = []

    for table in tables:
        rows = table.get("rows", [])
        table_text = "\n".join(
            " | ".join(str(cell) for cell in row)
            for row in rows
        )

        if table_text.strip():
            page_number = table.get("page_number")
            table_id = table.get("table_id")

            texts.append({
                "text": (
                    f"Table {table_id} from page {page_number}:\n"
                    f"{table_text}"
                ),
                "table_id": table_id,
                "page_number": page_number,
            })

    if not texts:
        return {
            "document_id": document_id,
            "indexed_tables": 0,
            "collection": COLLECTION_NAME,
        }

    embeddings = model.encode(
        [item["text"] for item in texts],
        normalize_embeddings=True,
        show_progress_bar=True,
    )

    points = []

    for item, embedding in zip(texts, embeddings):
        stable_id = f"{document_id}:table:{item['table_id']}"
        point_id = str(uuid5(NAMESPACE_URL, stable_id))

        points.append(
            models.PointStruct(
                id=point_id,
                vector=embedding.tolist(),
                payload={
                    "document_id": document_id,
                    "chunk_id": stable_id,
                    "chunk_index": item["table_id"],
                    "text": item["text"],
                    "metadata": {
                        "page_number": item["page_number"],
                        "content_type": "table",
                        "table_id": item["table_id"],
                    },
                },
            )
        )

    # Remove previous table points for this document before reindexing.
    client.delete(
        collection_name=COLLECTION_NAME,
        points_selector=models.FilterSelector(
            filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="document_id",
                        match=models.MatchValue(value=document_id),
                    ),
                    models.FieldCondition(
                        key="metadata.content_type",
                        match=models.MatchValue(value="table"),
                    ),
                ]
            )
        ),
        wait=True,
    )

    client.upsert(
        collection_name=COLLECTION_NAME,
        points=points,
        wait=True,
    )

    return {
        "document_id": document_id,
        "indexed_tables": len(points),
        "collection": COLLECTION_NAME,
    }