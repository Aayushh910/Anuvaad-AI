import logging
import os
from pathlib import Path
import fitz

from app.services.loaders.base import BaseLoader, Segment, compute_file_hash
from app.services.loaders.image_processor import image_processor

logger = logging.getLogger(__name__)


class PdfLoader(BaseLoader):
    """
    Format-agnostic PDF loader that handles:
    - Native digital text
    - Scanned/low-text pages (rendered and sent to image-understanding)
    - Embedded charts, diagrams, and figures inside pages
    """

    def load(self, path: Path | str) -> list[Segment]:
        pdf_path = Path(path).resolve()
        file_hash = compute_file_hash(pdf_path)
        min_text_chars = int(os.getenv("MIN_PAGE_TEXT_CHARS", "40"))
        segments: list[Segment] = []

        try:
            doc = fitz.open(pdf_path)
        except Exception as e:
            logger.error("Failed to open PDF %s: %s", pdf_path.name, e)
            return []

        try:
            for page_idx, page in enumerate(doc, start=1):
                try:
                    native_text = page.get_text("text").strip()
                    image_parts = []
                    content_type = "text"

                    # 1. Scanned page / visual diagram detection: page has little to no extractable text
                    if len(native_text) < min_text_chars:
                        content_type = "image_ocr"
                        try:
                            # Render page at 2x resolution (144 dpi) for high-accuracy OCR / Vision
                            pix = page.get_pixmap(dpi=144)
                            img_bytes = pix.tobytes("png")
                            desc = image_processor.process_image(
                                image_bytes=img_bytes,
                                file_hash=file_hash,
                                index_or_page=f"p{page_idx}_scan",
                                ext="png",
                            )
                            if desc:
                                image_parts.append(f"[Scanned page visual content]:\n{desc}")
                        except Exception as e:
                            logger.warning("Failed rendering scanned page %s in %s: %s", page_idx, pdf_path.name, e)

                    # 2. Extract embedded images on this page
                    try:
                        for img_idx, img in enumerate(page.get_images(full=True), start=1):
                            xref = img[0]
                            base_img = doc.extract_image(xref)
                            if not base_img or not base_img.get("image"):
                                continue

                            # Skip trivial spacer or tiny icon images (e.g., width < 50 or height < 50)
                            if base_img.get("width", 0) < 50 or base_img.get("height", 0) < 50:
                                continue

                            img_bytes = base_img["image"]
                            ext = base_img.get("ext", "png")

                            desc = image_processor.process_image(
                                image_bytes=img_bytes,
                                file_hash=file_hash,
                                index_or_page=f"p{page_idx}_img{img_idx}",
                                ext=ext,
                            )
                            if desc:
                                image_parts.append(f"[Image content]:\n{desc}")
                                if not native_text:
                                    content_type = "image_caption"
                    except Exception as e:
                        logger.warning("Error extracting embedded images on page %s of %s: %s", page_idx, pdf_path.name, e)

                    # Merge native text and image-derived text so they share the same context
                    combined_text_parts = []
                    if native_text:
                        combined_text_parts.append(native_text)
                    if image_parts:
                        combined_text_parts.extend(image_parts)

                    merged_text = "\n\n".join(combined_text_parts).strip()
                    if merged_text:
                        segments.append(
                            Segment(
                                text=merged_text,
                                source=pdf_path.name,
                                page_or_slide_or_sheet=page_idx,
                                content_type=content_type,
                                metadata={
                                    "file_hash": file_hash,
                                    "page_number": page_idx,
                                    "has_visual_content": len(image_parts) > 0,
                                },
                            )
                        )
                except Exception as page_err:
                    logger.error("Failed processing page %s of %s: %s. Continuing with remaining pages.", page_idx, pdf_path.name, page_err)
                    continue
        finally:
            doc.close()

        return segments

