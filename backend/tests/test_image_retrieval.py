import json

import pytest

from app.services.image_retrieval import (
    get_document_images,
    rank_document_images,
)


def test_get_document_images_returns_page_metadata(tmp_path, monkeypatch):
    processed_dir = tmp_path / "processed"
    image_root = processed_dir / "images"
    document_id = "test-document"

    document_image_dir = image_root / document_id
    document_image_dir.mkdir(parents=True)

    image_file = document_image_dir / "page_1_image_1.png"
    image_file.write_bytes(b"test-image")

    metadata = [
        {
            "page_number": 1,
            "image_index": 1,
            "filename": image_file.name,
            "width": 100,
            "height": 100,
        }
    ]

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
        json.dumps(
            [
                {
                    "page_number": 2,
                    "image_index": 1,
                    "filename": "missing.png",
                }
            ]
        ),
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


def test_rank_document_images_prioritizes_scorecard():
    images = [
        {
            "page_number": 9,
            "image_index": 1,
            "filename": "page_9_image_1.png",
            "caption": "Line chart showing run progression",
        },
        {
            "page_number": 9,
            "image_index": 2,
            "filename": "page_9_image_2.png",
            "caption": "Full scorecard showing runs, fours and sixes",
        },
        {
            "page_number": 10,
            "image_index": 1,
            "filename": "page_10_image_1.png",
            "caption": "Wagon wheel showing runs by region",
        },
    ]

    ranked = rank_document_images(
        images,
        question="How many runs, fours and sixes did A. Verma score?",
        context=(
            "Figure 6: Full scorecard. "
            "Figure 7: Wagon wheel showing runs by region."
        ),
    )

    assert ranked[0]["filename"] == "page_9_image_2.png"


def test_rank_document_images_prioritizes_wagon_wheel():
    images = [
        {
            "page_number": 9,
            "image_index": 2,
            "filename": "page_9_image_2.png",
            "caption": "Full scorecard showing runs, fours and sixes",
        },
        {
            "page_number": 10,
            "image_index": 1,
            "filename": "page_10_image_1.png",
            "caption": "Wagon wheel showing scoring regions",
        },
    ]

    ranked = rank_document_images(
        images,
        question="Which regions of the ground contributed A. Verma's runs?",
        context="Figure 7: Wagon wheel showing runs scored in each region.",
    )

    assert ranked[0]["filename"] == "page_10_image_1.png"


def test_rank_document_images_preserves_all_images():
    images = [
        {
            "page_number": 3,
            "image_index": 1,
            "filename": "page_3_image_1.png",
        },
        {
            "page_number": 5,
            "image_index": 1,
            "filename": "page_5_image_1.png",
        },
    ]

    ranked = rank_document_images(
        images,
        question="Explain this picture",
        context="",
    )

    assert len(ranked) == len(images)
    assert {image["filename"] for image in ranked} == {
        "page_3_image_1.png",
        "page_5_image_1.png",
    }