import app.services.vector_store as vector_store


def test_index_document_with_tables(monkeypatch):
    monkeypatch.setattr(
        vector_store,
        "index_document",
        lambda document_id: {
            "document_id": document_id,
            "indexed_chunks": 5,
            "collection": "pdf_chunks",
        },
    )

    def fake_index_tables(document_id):
        return {
            "document_id": document_id,
            "indexed_tables": 2,
            "collection": "pdf_chunks",
        }

    import app.services.table_indexing as table_indexing

    monkeypatch.setattr(
        table_indexing,
        "index_document_tables",
        fake_index_tables,
    )

    result = vector_store.index_document_with_tables("test-document")

    assert result["document_id"] == "test-document"
    assert result["indexed_chunks"] == 5
    assert result["indexed_tables"] == 2
