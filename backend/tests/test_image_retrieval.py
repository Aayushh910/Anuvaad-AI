
import json

import pytest

from app.services.image_retrieval import get_document_images


def test_get_document_images_returns_page_metadata(tmp_path, monkeypatch):
    processed_dir = tmp_path / "processed"
    image_root = processed_dir / "images"
    document_id = "test-document"

    document_image_dir = image_root / document_id
    document_image_dir.mkdir(parents=True)

    image_file = document_image_dir / "page_1_image_1.png"
    image_file.write_bytes(b"test-image")

    metadata = [{
        "page_number": 1,
        "image_index": 1,
        "filename": image_file.name,
        "width": 100,
        "height": 100,
    }]

    (processed_dir / f"{document_id}.images.json").write_text(
        json.dumps(metadata),
        encoding="utf-8",
    )

    monkeypatch.setattr(
        "app.services.image_retrieval.PROCESSED_DIR",
        processed_dir,
    )
    monkeypatch.setattr(
        "app.services.image_retrieval.IMAGE_ROOT",
        image_root,
    )

    images = get_document_images(document_id)

    assert len(images) == 1
    assert images[0]["document_id"] == document_id
    assert images[0]["page_number"] == 1
    assert images[0]["content_type"] == "image"
    assert images[0]["image_path"] == str(image_file.resolve())


def test_get_document_images_raises_when_metadata_missing(
    tmp_path, monkeypatch
):
    monkeypatch.setattr(
        "app.services.image_retrieval.PROCESSED_DIR",
        tmp_path / "processed",
    )
    monkeypatch.setattr(
        "app.services.image_retrieval.IMAGE_ROOT",
        tmp_path / "processed" / "images",
    )

    with pytest.raises(FileNotFoundError):
        get_document_images("missing-document")


def test_get_document_images_skips_missing_image_files(
    tmp_path, monkeypatch
):
    processed_dir = tmp_path / "processed"
    image_root = processed_dir / "images"
    (image_root / "test-document").mkdir(parents=True)

    (processed_dir / "test-document.images.json").write_text(
        json.dumps([{
            "page_number": 2,
            "image_index": 1,
            "filename": "missing.png",
        }]),
        encoding="utf-8",
    )

    monkeypatch.setattr(
        "app.services.image_retrieval.PROCESSED_DIR",
        processed_dir,
    )
    monkeypatch.setattr(
        "app.services.image_retrieval.IMAGE_ROOT",
        image_root,
    )

    assert get_document_images("test-document") == []
