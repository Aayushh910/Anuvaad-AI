import json
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[2]
PROCESSED_DIR = BASE_DIR / "storage" / "processed"
IMAGE_ROOT = PROCESSED_DIR / "images"


def get_document_images(document_id: str) -> list[dict]:
    """Return existing extracted images with document and page metadata."""
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

        image_path = (document_image_dir / filename).resolve()

        # Keep image access restricted to this document's image directory.
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
    """Rank images using question intent and persisted image descriptions."""
    if not images:
        return []

    question_lower = question.lower()
    context_lower = context.lower()

    # Normalize wagon-wheel questions before matching visual types.
    if any(
        phrase in question_lower
        for phrase in (
            "regions of the ground",
            "which regions",
            "scoring regions",
            "contributed the runs",
            "where were the runs scored",
        )
    ):
        question_lower += " wagon wheel scoring regions"

    visual_types = {
        "scorecard": (
            "scorecard", "batter", "batsman", "runs",
            "fours", "sixes", "wickets",
        ),
        "wagon_wheel": (
            "wagon wheel", "scoring regions",
            "regions of the ground", "which regions",
            "region of the ground", "contributed",
            "shot direction", "scoring area",
        ),
        "chart": (
            "chart", "graph", "trend", "progression",
            "over time", "percentage", "distribution",
        ),
        "diagram": (
            "diagram", "illustration", "schematic",
            "components", "connections",
        ),
        "fielding": (
            "fielding positions", "field placements", "fielders",
        ),
        "table": (
            "table", "tabular", "rows", "columns",
        ),
    }

    matched_types = {
        visual_type
        for visual_type, terms in visual_types.items()
        if any(term in question_lower for term in terms)
    }

    # When the question asks about ground regions, prioritize wagon wheels.
    if "wagon wheel scoring regions" in question_lower:
        matched_types.discard("scorecard")
        matched_types.add("wagon_wheel")

    question_terms = {
        term.strip(".,?!:;()[]{}\"'")
        for term in question_lower.split()
        if len(term.strip(".,?!:;()[]{}\"'")) > 2
    }

    def score(image: dict) -> int:
        filename = str(image.get("filename", "")).lower()
        caption = str(image.get("caption", "")).lower()
        description = str(image.get("description", "")).lower()
        metadata_text = f"{filename} {caption} {description}"

        value = 0

        # Strong filename match.
        if "wagon_wheel" in matched_types and "wagon_wheel" in filename:
            value += 50

        if "scorecard" in matched_types and "scorecard" in filename:
            value += 50

        # Match visual type against image metadata.
        for visual_type in matched_types:
            terms = visual_types[visual_type]
            if any(term in metadata_text for term in terms):
                value += 20

        # Use document context as supporting evidence.
        for visual_type in matched_types:
            terms = visual_types[visual_type]
            if (
                any(term in context_lower for term in terms)
                and any(term in metadata_text for term in terms)
            ):
                value += 15

        metadata_terms = set(
            metadata_text.replace("-", " ").replace("_", " ").split()
        )
        value += len(question_terms & metadata_terms)

        return value

    # Highest score first; use page order to break ties.
    return sorted(
        images,
        key=lambda image: (
            -score(image),
            image.get("page_number", 0),
            image.get("image_index", 0),
            str(image.get("filename", "")),
        ),
    )
