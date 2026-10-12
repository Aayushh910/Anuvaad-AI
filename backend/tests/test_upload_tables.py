import json

from fastapi.testclient import TestClient

import app.main as main


def test_upload_saves_table_metadata(tmp_path, monkeypatch):
    upload_dir = tmp_path / "uploads"
    processed_dir = tmp_path / "processed"
    image_root = processed_dir / "images"

    upload_dir.mkdir()
    processed_dir.mkdir()
    image_root.mkdir(parents=True)

    monkeypatch.setattr(main, "UPLOAD_DIR", upload_dir)
    monkeypatch.setattr(main, "PROCESSED_DIR", processed_dir)
    monkeypatch.setattr(main, "IMAGE_ROOT", image_root)

    class FakeDocument:
        pages = [object()]

        def export_to_markdown(self):
            return "Sample PDF with a table"

        def iterate_items(self):
            return iter([])

    class FakeConverter:
        def convert(self, pdf_path):
            return type(
                "Result",
                (),
                {"document": FakeDocument()},
            )()

    monkeypatch.setattr(main, "DocumentConverter", FakeConverter)

    def fake_extract_pdf_images(
        pdf_path,
        output_dir,
        generate_descriptions=False,
    ):
        return []

    def fake_extract_tables(pdf_path):
        return [
            {
                "table_id": 1,
                "page_number": 1,
                "rows": [
                    ["Subject", "Marks"],
                    ["Mathematics", "95"],
                ],
                "row_count": 2,
                "column_count": 2,
            }
        ]

    monkeypatch.setattr(
        main, "extract_pdf_images", fake_extract_pdf_images
    )
    monkeypatch.setattr(
        main, "extract_tables", fake_extract_tables
    )

    client = TestClient(main.app)

    response = client.post(
        "/api/v1/documents/upload",
        files={
            "file": (
                "sample.pdf",
                b"fake PDF content",
                "application/pdf",
            )
        },
    )

    assert response.status_code == 200

    data = response.json()
    assert data["table_count"] == 1

    metadata_path = processed_dir / data["tables_metadata_file"]
    assert metadata_path.exists()

    tables = json.loads(metadata_path.read_text(encoding="utf-8"))

    assert len(tables) == 1
    assert tables[0]["page_number"] == 1
    assert tables[0]["rows"][1] == ["Mathematics", "95"]
    assert tables[0]["row_count"] == 2
    assert tables[0]["column_count"] == 2
