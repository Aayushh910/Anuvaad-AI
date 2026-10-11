import json
from pathlib import Path

import pytest

from app.services.chunking import chunk_document

BASE_DIR = Path(__file__).resolve().parents[1]
PROCESSED_DIR = BASE_DIR / "storage" / "processed"
CHUNKS_DIR = BASE_DIR / "storage" / "chunks"

DOCUMENT_ID = "4b43484a08ed4249b3a4add183621b3e"


def test_chunk_document_has_page_metadata():
    pages_path = PROCESSED_DIR / f"{DOCUMENT_ID}.pages.json"

    if not pages_path.exists():
        pytest.skip("Page-aware extraction has not been generated")

    result = chunk_document(DOCUMENT_ID)

    chunks_path = CHUNKS_DIR / result["chunk_file"]
    chunks = json.loads(chunks_path.read_text(encoding="utf-8"))

    assert result["chunk_count"] > 0
    assert result["page_aware"] is True
    assert all(
        isinstance(chunk["metadata"].get("page_number"), int)
        for chunk in chunks
    )