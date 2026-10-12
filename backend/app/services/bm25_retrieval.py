
import json
import re
from pathlib import Path
from rank_bm25 import BM25Plus

BASE_DIR = Path(__file__).resolve().parents[2]
CHUNKS_DIR = BASE_DIR / "storage" / "chunks"


def tokenize(text: str) -> list[str]:
    """Tokenize text for lexical retrieval."""
    return re.findall(r"\b\w+\b", text.lower())


def search_documents_bm25(
    query: str,
    limit: int = 5,
    document_id: str | None = None,
) -> list[dict]:
    """Retrieve chunks using BM25 lexical ranking."""

    if not query.strip():
        raise ValueError("Search query cannot be empty.")

    if limit <= 0:
        raise ValueError("Limit must be greater than zero.")

    if document_id:
        paths = [CHUNKS_DIR / f"{document_id}.json"]
        if not paths[0].exists():
            return []
    else:
        paths = sorted(CHUNKS_DIR.glob("*.json"))

    chunks = []

    for path in paths:
        data = json.loads(path.read_text(encoding="utf-8"))

        for chunk in data:
            text = chunk.get("text", "")
            if not text.strip():
                continue

            chunks.append({
                "chunk_id": chunk.get("chunk_id"),
                "document_id": chunk.get("document_id"),
                "chunk_index": chunk.get("chunk_index"),
                "text": text,
                "metadata": chunk.get("metadata", {}),
            })

    if not chunks:
        return []

    tokenized_chunks = [
        tokenize(chunk["text"]) for chunk in chunks
    ]

    if not any(tokenized_chunks):
        return []

    bm25 = BM25Plus(tokenized_chunks)
    query_tokens = tokenize(query)

    if not query_tokens:
        return []

    scores = bm25.get_scores(query_tokens)

    ranked_indices = sorted(
        range(len(chunks)),
        key=lambda index: (-float(scores[index]), index),
    )

    results = []

    for index in ranked_indices:
        score = float(scores[index])

        # BM25 can assign zero to chunks with no useful matches.
        if score <= 0:
            continue

        result = dict(chunks[index])
        result["score"] = score
        results.append(result)

        if len(results) >= limit:
            break

    return results
