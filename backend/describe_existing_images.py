
import json
import logging
from pathlib import Path

from app.services.vision import describe_image

logging.basicConfig(level=logging.INFO)

document_id = "35dda60c66aa4852bc4a97cf7feb8dba"
base_dir = Path(__file__).resolve().parent
metadata_path = base_dir / "storage" / "processed" / f"{document_id}.images.json"
image_dir = base_dir / "storage" / "processed" / "images" / document_id

records = json.loads(metadata_path.read_text(encoding="utf-8"))

for record in records:
    image_path = image_dir / record["filename"]

    if not image_path.is_file():
        print(f"SKIPPED: Missing {image_path.name}")
        continue

    if record.get("description"):
        print(f"Already described: {image_path.name}")
        continue

    try:
        print(f"Describing: {image_path.name}")
        record["description"] = describe_image(
            image_path=str(image_path),
            page_number=record["page_number"],
        )
        print(record["description"][:200])
    except Exception:
        logging.exception("Failed to describe %s", image_path.name)

metadata_path.write_text(
    json.dumps(records, indent=2, ensure_ascii=False),
    encoding="utf-8",
)

print(
    f"\nSaved descriptions for "
    f"{sum(bool(r.get('description')) for r in records)}/{len(records)} images."
)
