
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
    processed_dir = tmp_path / "processed"

    monkeypatch.setattr(
        "app.services.image_retrieval.PROCESSED_DIR",
        processed_dir,
    )
    monkeypatch.setattr(
        "app.services.image_retrieval.IMAGE_ROOT",
        processed_dir / "images",
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


def test_get_document_images_rejects_invalid_document_id():
    with pytest.raises(ValueError, match="Invalid document ID"):
        get_document_images("../outside-document")


def test_get_document_images_skips_path_traversal_filename(
    tmp_path, monkeypatch
):
    processed_dir = tmp_path / "processed"
    image_root = processed_dir / "images"
    document_image_dir = image_root / "test-document"
    document_image_dir.mkdir(parents=True)

    outside_file = image_root / "outside.png"
    outside_file.parent.mkdir(parents=True, exist_ok=True)
    outside_file.write_bytes(b"outside")

    (processed_dir / "test-document.images.json").write_text(
        json.dumps(
            [
                {
                    "page_number": 1,
                    "image_index": 1,
                    "filename": "../outside.png",
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


def test_rank_document_images_prioritizes_relevant_chart():
    images = [
        {
            "page_number": 1,
            "image_index": 1,
            "filename": "unrelated_chart.png",
            "caption": "Bar chart showing product categories",
            "description": "Sales by product category.",
        },
        {
            "page_number": 2,
            "image_index": 1,
            "filename": "energy_trend.png",
            "caption": "Line chart showing energy consumption over time",
            "description": "Monthly energy usage and consumption trends.",
        },
        {
            "page_number": 3,
            "image_index": 1,
            "filename": "diagram.png",
            "caption": "System architecture diagram",
            "description": (
                "Components and connections in a software system."
            ),
        },
    ]

    ranked = rank_document_images(
        images,
        question="How does energy consumption change over time?",
        context="The document discusses monthly energy usage trends.",
    )

    assert ranked[0]["filename"] == "energy_trend.png"


def test_rank_document_images_prioritizes_relevant_diagram():
    images = [
        {
            "page_number": 1,
            "image_index": 1,
            "filename": "chart.png",
            "caption": "Chart showing monthly costs",
            "description": "Monthly expenses and totals.",
        },
        {
            "page_number": 2,
            "image_index": 1,
            "filename": "architecture.png",
            "caption": "System architecture diagram",
            "description": "Components, connections, and interactions.",
        },
    ]

    ranked = rank_document_images(
        images,
        question="How are the system components connected?",
        context="The architecture explains component connections.",
    )

    assert ranked[0]["filename"] == "architecture.png"


def test_rank_document_images_prioritizes_relevant_table():
    images = [
        {
            "page_number": 1,
            "image_index": 1,
            "filename": "overview.png",
            "caption": "General document overview",
            "description": "A summary of the document.",
        },
        {
            "page_number": 2,
            "image_index": 1,
            "filename": "measurements.png",
            "caption": "Table of measurements",
            "description": "Rows and columns listing measured values.",
        },
    ]

    ranked = rank_document_images(
        images,
        question="What measurements are listed in the table?",
        context="The document contains a table of measured values.",
    )

    assert ranked[0]["filename"] == "measurements.png"


def test_rank_document_images_prioritizes_matching_description():
    images = [
        {
            "page_number": 1,
            "image_index": 1,
            "filename": "figure_a.png",
            "caption": "Illustration of a process",
            "description": "An overview of a manufacturing process.",
        },
        {
            "page_number": 2,
            "image_index": 1,
            "filename": "figure_b.png",
            "caption": "Network topology",
            "description": (
                "A network connecting routers, switches, and computers."
            ),
        },
    ]

    ranked = rank_document_images(
        images,
        question="Which devices are connected in the network?",
        context="The network topology shows connected devices.",
    )

    assert ranked[0]["filename"] == "figure_b.png"


def test_rank_document_images_preserves_all_images():
    images = [
        {
            "page_number": 3,
            "image_index": 1,
            "filename": "image_a.png",
        },
        {
            "page_number": 5,
            "image_index": 1,
            "filename": "image_b.png",
        },
    ]

    ranked = rank_document_images(
        images,
        question="Explain this picture",
        context="",
    )

    assert len(ranked) == len(images)
    assert {image["filename"] for image in ranked} == {
        "image_a.png",
        "image_b.png",
    }


def test_rank_document_images_uses_page_order_for_ties():
    images = [
        {
            "page_number": 5,
            "image_index": 1,
            "filename": "later.png",
            "caption": "Unrelated illustration",
            "description": "General overview.",
        },
        {
            "page_number": 2,
            "image_index": 1,
            "filename": "earlier.png",
            "caption": "Unrelated illustration",
            "description": "General overview.",
        },
    ]

    ranked = rank_document_images(
        images,
        question="Explain a concept not described in these images",
        context="",
    )

    assert ranked[0]["filename"] == "earlier.png"
    assert ranked[1]["filename"] == "later.png"
