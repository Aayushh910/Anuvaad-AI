from pathlib import Path
import fitz

from app.services.image_extraction import extract_pdf_images


def test_extract_pdf_images(tmp_path):
    pdf_path = tmp_path / "sample.pdf"
    output_dir = tmp_path / "images"

    # Create a PDF containing an embedded image.
    image_path = tmp_path / "sample.png"
    pixmap = fitz.Pixmap(
        fitz.csRGB, fitz.IRect(0, 0, 100, 100), 0
    )
    pixmap.clear_with(255)
    pixmap.save(str(image_path))

    document = fitz.open()
    page = document.new_page()
    page.insert_image(
        fitz.Rect(50, 50, 150, 150),
        filename=str(image_path),
    )
    document.save(str(pdf_path))
    document.close()

    results = extract_pdf_images(
        str(pdf_path),
        str(output_dir),
    )

    assert len(results) >= 1
    assert results[0]["page_number"] == 1
    assert results[0]["width"] > 0
    assert Path(results[0]["image_path"]).exists()
