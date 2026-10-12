from unittest.mock import MagicMock

from app.services import vector_store


def test_search_documents_returns_table_content(monkeypatch):
    table_text = (
        "Table 1 | Page 2\n"
        "Subject: Operating Systems\n"
        "Total Marks: 100"
    )

    fake_client = MagicMock()
    fake_point = MagicMock()
    fake_point.payload = {
        "document_id": "test-document",
        "chunk_id": "table_1",
        "text": table_text,
        "metadata": {
            "page_number": 2,
            "content_type": "table",
            "table_id": "table_1",
        },
    }
    fake_client.query_points.return_value.points = [fake_point]

    monkeypatch.setattr(vector_store, "client", fake_client)

    monkeypatch.setattr(
        vector_store,
        "model",
        MagicMock(
            encode=MagicMock(
                return_value=__import__("numpy").array([[0.1] * 384])
            )
        ),
    )

    results = vector_store.search_documents(
        "What are the total marks?",
        limit=5,
        document_id="test-document",
    )

    assert results
    assert any("Total Marks: 100" in item["text"] for item in results)

    table_result = next(
        item for item in results
        if "Total Marks: 100" in item["text"]
    )
    assert table_result["metadata"]["page_number"] == 2
    assert table_result["metadata"]["content_type"] == "table"