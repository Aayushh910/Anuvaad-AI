
import argparse
import json
import logging
from pathlib import Path

from app.services.vision import describe_image

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
PROCESSED_DIR = BASE_DIR / "storage" / "processed"
IMAGE_ROOT = PROCESSED_DIR / "images"


def describe_existing_images(document_id: str) -> None:
    if not document_id or Path(document_id).name != document_id:
        raise ValueError("Invalid document ID.")

    metadata_path = PROCESSED_DIR / f"{document_id}.images.json"
    image_dir = IMAGE_ROOT / document_id

    if not metadata_path.is_file():
        raise FileNotFoundError(
            f"Image metadata not found for document: {document_id}"
        )

    records = json.loads(metadata_path.read_text(encoding="utf-8"))

    if not isinstance(records, list):
        raise ValueError("Image metadata must contain a JSON list.")

    succeeded = 0
    failed = 0
    skipped = 0

    for record in records:
        if not isinstance(record, dict):
            skipped += 1
            continue

        filename = record.get("filename")
        if not isinstance(filename, str) or not filename:
            skipped += 1
            continue

        image_path = (image_dir / filename).resolve()

        if image_path.parent != image_dir.resolve():
            logger.warning("Skipped unsafe filename: %s", filename)
            skipped += 1
            continue

        if not image_path.is_file():
            logger.warning("Missing image: %s", filename)
            skipped += 1
            continue

        if record.get("description"):
            logger.info("Already described: %s", filename)
            skipped += 1
            continue

        try:
            logger.info("Describing: %s", filename)
            description = describe_image(
                image_path=str(image_path),
                page_number=record.get("page_number"),
            )

            if description and description.strip():
                record["description"] = description.strip()
                succeeded += 1
            else:
                logger.warning("No description returned for %s", filename)
                failed += 1

        except Exception:
            logger.exception("Failed to describe %s", filename)
            failed += 1

        # Persist after each image so a later failure does not lose progress.
        metadata_path.write_text(
            json.dumps(records, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    metadata_path.write_text(
        json.dumps(records, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    print(
        f"\nFinished document {document_id}: "
        f"{succeeded} described, {skipped} skipped, {failed} failed."
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generate descriptions for existing PDF images."
    )
    parser.add_argument(
        "document_id",
        help="ID of the uploaded document to process",
    )
    args = parser.parse_args()

    describe_existing_images(args.document_id)
