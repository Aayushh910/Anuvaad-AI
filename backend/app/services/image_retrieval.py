
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


def rank_document_images(
    images: list[dict],
    question: str,
    context: str = "",
) -> list[dict]:
    """Rank images using question intent, text context, and image metadata."""
    if not images:
        return []

    question_lower = question.lower()
    context_lower = context.lower()

    visual_types = {
        "scorecard": (
            "scorecard",
            "batter",
            "batsman",
            "fours",
            "sixes",
            "wickets",
        ),
        "wagon_wheel": (
            "wagon wheel",
            "scoring regions",
            "regions of the ground",
            "which regions",
        ),
        "chart": (
            "chart",
            "graph",
            "trend",
            "progression",
            "over time",
        ),
        "diagram": (
            "diagram",
            "illustration",
            "schematic",
        ),
        "fielding": (
            "fielding positions",
            "field placements",
            "fielders",
        ),
    }

    matched_types = {
        visual_type
        for visual_type, terms in visual_types.items()
        if any(term in question_lower for term in terms)
    }

    
    def score(image: dict) -> int:
        filename = str(image.get("filename", "")).lower()
        caption = str(image.get("caption", "")).lower()
        description = str(image.get("description", "")).lower()
        metadata_text = f"{filename} {caption} {description}"
        value = 0

        # Strongly prefer images whose metadata identifies their visual type.
        for visual_type in matched_types:
            terms = visual_types[visual_type]
            if any(term in metadata_text for term in terms):
                value += 10

        # Match visual type to descriptions found in the retrieved text.
        if "scorecard" in matched_types and "scorecard" in context_lower:
            if "scorecard" in metadata_text:
                value += 15

        if "wagon_wheel" in matched_types and "wagon wheel" in context_lower:
            if "wagon wheel" in metadata_text:
                value += 15

        # Prefer images with a descriptive filename over anonymous filenames
        # only when the filename actually contains a relevant visual term.
        if "scorecard" in matched_types and "scorecard" in filename:
            value += 5

        if "wagon_wheel" in matched_types and (
            "wagon wheel" in filename or "wagon_wheel" in filename
        ):
            value += 5

        return value


    return sorted(
        images,
        key=lambda image: (
            -score(image),
            image.get("page_number", 0),
            image.get("image_index", 0),
            str(image.get("filename", "")),
        ),
    )
