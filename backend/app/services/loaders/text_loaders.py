import logging
import re
from pathlib import Path
from app.services.loaders.base import BaseLoader, Segment, compute_file_hash

logger = logging.getLogger(__name__)


class TextLoader(BaseLoader):
    """Loader for Plain Text, Markdown, and HTML documents."""

    def load(self, path: Path | str) -> list[Segment]:
        file_path = Path(path).resolve()
        file_hash = compute_file_hash(file_path)

        try:
            raw_text = file_path.read_text(encoding="utf-8", errors="replace")
        except Exception as e:
            logger.error("Failed to read text file %s: %s", file_path.name, e)
            return []

        ext = file_path.suffix.lower()
        if ext in (".html", ".htm"):
            # Strip html tags and scripts cleanly
            clean_text = re.sub(r"<script[\s\S]*?</script>", "", raw_text, flags=re.IGNORECASE)
            clean_text = re.sub(r"<style[\s\S]*?</style>", "", clean_text, flags=re.IGNORECASE)
            clean_text = re.sub(r"<[^>]+>", " ", clean_text)
            clean_text = re.sub(r"\s+", " ", clean_text).strip()
        else:
            clean_text = raw_text.strip()

        if not clean_text:
            return []

        return [
            Segment(
                text=clean_text,
                source=file_path.name,
                page_or_slide_or_sheet=1,
                content_type="text",
                metadata={"file_hash": file_hash},
            )
        ]

