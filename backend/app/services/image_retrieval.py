
import json
import re
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[2]
PROCESSED_DIR = BASE_DIR / "storage" / "processed"
IMAGE_ROOT = PROCESSED_DIR / "images"

# Common words that rarely help distinguish relevant images.
STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for",
    "from", "how", "in", "into", "is", "it", "of", "on", "or",
    "that", "the", "their", "this", "to", "was", "were", "what",
    "when", "where", "which", "who", "why", "with", "would",
    "does", "do", "did", "can", "could", "show", "shows",
    "shown", "explain", "describe", "according", "document",
    "image", "figure", "picture",
}


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

        # Only allow files directly inside this document's image directory.
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


def _normalize_token(token: str) -> str:
    """Apply lightweight normalization without domain-specific vocabulary."""
    token = token.lower()

    # Normalize common English plurals for matching, e.g. measurements
    # to measurement and runs to run.
    if len(token) > 4 and token.endswith("ies"):
        return token[:-3] + "y"

    if (
        len(token) > 4
        and token.endswith("s")
        and not token.endswith(("ss", "us", "is"))
    ):
        return token[:-1]

    return token


def _tokenize(text: str) -> set[str]:
    """Extract useful normalized terms from arbitrary text."""
    tokens = re.findall(r"[a-z0-9]+", text.lower())

    return {
        _normalize_token(token)
        for token in tokens
        if len(token) > 1 and token not in STOP_WORDS
    }


def rank_document_images(
    images: list[dict],
    question: str,
    context: str = "",
) -> list[dict]:
    """
    Rank images using question relevance, image metadata, and context.

    This function does not assume a particular document topic or visual type.
    It preserves all images and uses page order to break ranking ties.
    """
    if not images:
        return []

    question_terms = _tokenize(question)
    context_terms = _tokenize(context)

    def score(image: dict) -> int:
        filename = str(image.get("filename", "")).replace("_", " ")
        caption = str(image.get("caption", ""))
        description = str(image.get("description", ""))

        filename_terms = _tokenize(filename)
        caption_terms = _tokenize(caption)
        description_terms = _tokenize(description)

        metadata_terms = (
            filename_terms | caption_terms | description_terms
        )

        # Weight explicit captions and descriptions more strongly than
        # filenames, which may contain generic or automatically generated text.
        value = 0
        value += 2 * len(question_terms & filename_terms)
        value += 3 * len(question_terms & caption_terms)
        value += 3 * len(question_terms & description_terms)

        # Document context is supporting evidence, not a substitute for
        # matching the user's question.
        question_metadata_matches = question_terms & metadata_terms
        context_matches = context_terms & metadata_terms

        value += 2 * len(question_metadata_matches & context_matches)

        value += len(context_matches)

        # Reward images that cover several distinct terms from the question.
        # This helps distinguish a directly relevant image from one that
        # happens to mention a single common term.
        value += 2 * len(question_terms & metadata_terms)

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
