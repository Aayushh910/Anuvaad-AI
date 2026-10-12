from pathlib import Path
import fitz  # PyMuPDF


def extract_pdf_images(
    pdf_path: str,
    output_dir: str,
) -> list[dict]:
    """
    Extract embedded images from a PDF.

    Page numbers are 1-based.
    Returns metadata for each successfully saved image.
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

                extracted_images.append({
                    "page_number": page_index + 1,
                    "image_index": image_index,
                    "xref": xref,
                    "filename": filename,
                    "image_path": str(image_path),
                    "extension": extension,
                    "width": image_data["width"],
                    "height": image_data["height"],
                    "size_bytes": len(image_bytes),
                })

    return extracted_images