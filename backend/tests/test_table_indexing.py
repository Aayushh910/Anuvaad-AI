import json
import numpy as np  
import app.services.table_indexing as table_indexing


def test_index_document_tables(tmp_path, monkeypatch):
    processed_dir = tmp_path / "processed"
    processed_dir.mkdir()

    document_id = "test-document"

    tables = [
        {
            "table_id": 1,
            "page_number": 2,
            "rows": [
                ["Subject", "Marks"],
                ["Mathematics", "95"],
            ],
            "row_count": 2,
            "column_count": 2,
        }
    ]

    tables_path = processed_dir / f"{document_id}.tables.json"
    tables_path.write_text(
        json.dumps(tables),
        encoding="utf-8",
    )

    monkeypatch.setattr(
        table_indexing,
        "PROCESSED_DIR",
        processed_dir,
    )

    captured = {}

    class FakeModel:
        def encode(self, texts, **kwargs):
            captured["texts"] = texts
            return [np.array([0.1] * 384) for _ in texts]

    class FakeClient:
        def delete(self, **kwargs):
            pass

        def upsert(self, **kwargs):
            captured["points"] = kwargs["points"]

    monkeypatch.setattr(table_indexing, "model", FakeModel())
    monkeypatch.setattr(table_indexing, "client", FakeClient())

    result = table_indexing.index_document_tables(document_id)

    assert result["indexed_tables"] == 1
    assert result["document_id"] == document_id

    assert len(captured["texts"]) == 1
    assert "Mathematics | 95" in captured["texts"][0]
    assert "page 2" in captured["texts"][0]

    point = captured["points"][0]
    assert point.payload["document_id"] == document_id
    assert point.payload["metadata"]["content_type"] == "table"
    assert point.payload["metadata"]["page_number"] == 2


def test_index_document_tables_empty_list(tmp_path, monkeypatch):
    processed_dir = tmp_path / "processed"
    processed_dir.mkdir()
    document_id = "empty-document"

    (processed_dir / f"{document_id}.tables.json").write_text(
        "[]",
        encoding="utf-8",
    )
    monkeypatch.setattr(table_indexing, "PROCESSED_DIR", processed_dir)

    result = table_indexing.index_document_tables(document_id)

    assert result["document_id"] == document_id
    assert result["indexed_tables"] == 0


def test_index_document_tables_missing_file(tmp_path, monkeypatch):
    monkeypatch.setattr(table_indexing, "PROCESSED_DIR", tmp_path)

    import pytest

    with pytest.raises(FileNotFoundError, match="Extracted tables not found"):
        table_indexing.index_document_tables("missing-document")


def test_index_document_tables_skips_empty_rows(tmp_path, monkeypatch):
    processed_dir = tmp_path / "processed"
    processed_dir.mkdir()
    document_id = "blank-table-document"

    tables = [
        {"table_id": 1, "page_number": 1, "rows": []},
        {"table_id": 2, "page_number": 3, "rows": [["Runs", "100"]]},
    ]
    (processed_dir / f"{document_id}.tables.json").write_text(
        json.dumps(tables),
        encoding="utf-8",
    )
    monkeypatch.setattr(table_indexing, "PROCESSED_DIR", processed_dir)

    captured = {}

    class FakeModel:
        def encode(self, texts, **kwargs):
            captured["texts"] = texts
            return [np.array([0.1] * 384) for _ in texts]

    class FakeClient:
        def delete(self, **kwargs):
            pass

        def upsert(self, **kwargs):
            captured["points"] = kwargs["points"]

    monkeypatch.setattr(table_indexing, "model", FakeModel())
    monkeypatch.setattr(table_indexing, "client", FakeClient())

    result = table_indexing.index_document_tables(document_id)

    assert result["indexed_tables"] == 1
    assert len(captured["points"]) == 1
    assert captured["points"][0].payload["metadata"]["table_id"] == 2
    assert "Runs | 100" in captured["texts"][0]
