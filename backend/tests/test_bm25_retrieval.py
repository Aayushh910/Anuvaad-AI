
import json

import pytest

from app.services import bm25_retrieval as bm25


def test_tokenize_normalizes_text():
    assert bm25.tokenize("T20 Powerplay!") == [
        "t20", "powerplay"
    ]


def test_empty_query_raises():
    with pytest.raises(ValueError, match="empty"):
        bm25.search_documents_bm25("   ")


def test_invalid_limit_raises():
    with pytest.raises(ValueError, match="Limit"):
        bm25.search_documents_bm25("powerplay", limit=0)


def test_relevant_chunk_ranks_first(monkeypatch, tmp_path):
    document_id = "test-document"

    chunks = [
        {
            "chunk_id": "unrelated",
            "document_id": document_id,
            "chunk_index": 0,
            "text": "The history of cricket is very long.",
            "metadata": {},
        },
        {
            "chunk_id": "relevant",
            "document_id": document_id,
            "chunk_index": 1,
            "text": (
                "During the T20 powerplay, only two fielders "
                "may stand outside the 30-yard circle."
            ),
            "metadata": {},
        },
    ]

    (tmp_path / f"{document_id}.json").write_text(
        json.dumps(chunks), encoding="utf-8"
    )
    monkeypatch.setattr(bm25, "CHUNKS_DIR", tmp_path)

    results = bm25.search_documents_bm25(
        "T20 powerplay two fielders outside 30-yard circle",
        limit=2,
        document_id=document_id,
    )

    assert results
    assert results[0]["chunk_id"] == "relevant"
    assert results[0]["score"] > 0


def test_missing_document_returns_empty(monkeypatch, tmp_path):
    monkeypatch.setattr(bm25, "CHUNKS_DIR", tmp_path)

    assert bm25.search_documents_bm25(
        "powerplay",
        document_id="missing-document",
    ) == []
