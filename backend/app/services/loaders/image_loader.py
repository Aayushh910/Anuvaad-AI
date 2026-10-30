import logging
from pathlib import Path
from app.services.loaders.base import BaseLoader, Segment, compute_file_hash
from app.services.loaders.image_processor import image_processor

logger = logging.getLogger(__name__)


class ImageLoader(BaseLoader):
    """Loader for standalone images (PNG, JPG, JPEG, WEBP)."""

    def load(self, path: Path | str) -> list[Segment]:
        img_path = Path(path).resolve()
        file_hash = compute_file_hash(img_path)

        try:
            img_bytes = img_path.read_bytes()
        except Exception as e:
            logger.error("Failed to read image file %s: %s", img_path.name, e)
            return []

        ext = img_path.suffix.lower().replace(".", "")
        transcription_and_desc = image_processor.process_image(
            image_bytes=img_bytes,
            file_hash=file_hash,
            index_or_page=1,
            ext=ext,
        )

        if not transcription_and_desc:
            return []

        return [
            Segment(
                text=transcription_and_desc,
                source=img_path.name,
                page_or_slide_or_sheet=1,
                content_type="image_ocr",
                image_bytes=img_bytes,
                metadata={
                    "file_hash": file_hash,
                    "has_visual_content": True,
                },
            )
        ]

