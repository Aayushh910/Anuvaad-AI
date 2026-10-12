import json

from fastapi.testclient import TestClient

import app.main as main


def test_upload_saves_image_metadata(tmp_path, monkeypatch):
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
            return "Sample PDF content"

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

    def fake_extract_pdf_images(pdf_path, output_dir):
        output = image_root / "test_image.png"
        output.write_bytes(b"fake image")

        return [
            {
                "page_number": 1,
                "image_index": 1,
                "filename": "test_image.png",
                "image_path": str(output),
                "extension": "png",
                "width": 100,
                "height": 50,
                "size_bytes": 10,
            }
        ]

    monkeypatch.setattr(
        main, "extract_pdf_images", fake_extract_pdf_images
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
    assert data["image_count"] == 1

    metadata_path = processed_dir / data["images_metadata_file"]
    assert metadata_path.exists()

    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    assert len(metadata) == 1
    assert metadata[0]["page_number"] == 1
    assert metadata[0]["filename"] == "test_image.png"
