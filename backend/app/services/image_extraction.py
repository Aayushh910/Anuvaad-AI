import logging
from pathlib import Path

import fitz  # PyMuPDF

from app.services.vision import describe_image

logger = logging.getLogger(__name__)


def extract_pdf_images(
    pdf_path: str,
    output_dir: str,
    generate_descriptions: bool = False,
) -> list[dict]:
    """
    Extract embedded images from a PDF.

    Page numbers are 1-based.
    Returns metadata for each successfully saved image.

    Image descriptions are optional because they require vision API calls.
    A description failure does not prevent PDF image extraction.
    """
    pdf_file = Path(pdf_path)
    destination = Path(output_dir)
    destination.mkdir(parents=True, exist_ok=True)

    extracted_images = []

    with fitz.open(pdf_file) as document:
        for page_index, page in enumerate(document):
            for image_index, image in enumerate(
                page.get_images(full=True), start=1
            ):
                xref = image[0]
                image_data = document.extract_image(xref)

                if not image_data:
                    continue

                image_bytes = image_data["image"]
                extension = image_data["ext"]

                filename = (
                    f"page_{page_index + 1}_image_{image_index}."
                    f"{extension}"
                )
                image_path = destination / filename
                image_path.write_bytes(image_bytes)

                metadata = {
                    "page_number": page_index + 1,
                    "image_index": image_index,
                    "xref": xref,
                    "filename": filename,
                    "image_path": str(image_path),
                    "extension": extension,
                    "width": image_data["width"],
                    "height": image_data["height"],
                    "size_bytes": len(image_bytes),
                    "description": None,
                }

                if generate_descriptions:
                    try:
                        metadata["description"] = describe_image(
                            image_path=str(image_path),
                            page_number=page_index + 1,
                        )
                    except Exception:
                        logger.exception(
                            "Could not describe image %s on page %s",
                            filename,
                            page_index + 1,
                        )

                extracted_images.append(metadata)

    return extracted_images