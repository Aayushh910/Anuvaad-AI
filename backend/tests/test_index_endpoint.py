from fastapi.testclient import TestClient

import app.main as main


def test_index_endpoint(monkeypatch):
    monkeypatch.setattr(
        main,
        "chunk_document",
        lambda document_id: {
            "document_id": document_id,
            "chunk_count": 5,
        },
    )

    monkeypatch.setattr(
        main,
        "index_document_with_tables",
        lambda document_id: {
            "document_id": document_id,
            "indexed_chunks": 5,
            "indexed_tables": 2,
            "collection": "pdf_chunks",
        },
    )

    client = TestClient(main.app)

    response = client.post(
        "/api/v1/documents/test-document/index"
    )

    assert response.status_code == 200, response.text

    data = response.json()
    assert data["status"] == "success"
    assert data["document_id"] == "test-document"
    assert data["chunk_count"] == 5
    assert data["indexed_chunks"] == 5
    assert data["indexed_tables"] == 2
    assert data["collection"] == "pdf_chunks"