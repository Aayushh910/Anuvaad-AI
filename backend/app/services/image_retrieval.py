
import json
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[2]
PROCESSED_DIR = BASE_DIR / "storage" / "processed"
IMAGE_ROOT = PROCESSED_DIR / "images"


def get_document_images(document_id: str) -> list[dict]:
    """Return existing extracted images for a document with page metadata."""
    if not document_id or Path(document_id).name != document_id:
        raise ValueError("Invalid document ID.")

    metadata_path = PROCESSED_DIR / f"{document_id}.images.json"

    if not metadata_path.is_file():
        raise FileNotFoundError(
            f"Image metadata not found for document: {document_id}"
        )

    try:
        records = json.loads(metadata_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ValueError("Image metadata contains invalid JSON.") from exc

    if not isinstance(records, list):
        raise ValueError("Image metadata must contain a JSON list.")

    document_image_dir = (IMAGE_ROOT / document_id).resolve()
    images = []

    for record in records:
        if not isinstance(record, dict):
            continue

        filename = record.get("filename")
        if not isinstance(filename, str) or not filename:
            continue

        # Resolve images only inside this document's image directory.
        image_path = (document_image_dir / filename).resolve()

        if image_path.parent != document_image_dir:
            continue

        if not image_path.is_file():
            continue

        images.append({
            **record,
            "document_id": document_id,
            "image_path": str(image_path),
            "content_type": "image",
        })

    return sorted(
        images,
        key=lambda image: (
            image.get("page_number", 0),
            image.get("image_index", 0),
        ),
    )
