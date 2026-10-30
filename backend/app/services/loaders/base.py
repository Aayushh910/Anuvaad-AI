from abc import ABC, abstractmethod
from dataclasses import dataclass, field
import hashlib
from pathlib import Path
from typing import Any


@dataclass
class Segment:
    """Represents a unified extracted segment of a document."""
    text: str
    source: str
    page_or_slide_or_sheet: int | str
    content_type: str  # "text" | "image_ocr" | "image_caption" | "table"
    image_bytes: bytes | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


def compute_file_hash(path: Path | str) -> str:
    """Compute SHA-256 hash of a file for deterministic caching and document identification."""
    p = Path(path).resolve()
    hasher = hashlib.sha256()
    with open(p, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


class BaseLoader(ABC):
    """Abstract base loader for all document types."""

    @abstractmethod
    def load(self, path: Path | str) -> list[Segment]:
        """Extract content from file path into a list of Segments."""
        pass


class LoaderRegistry:
    """Central registry mapping file extensions and MIME types to loaders."""

    def __init__(self):
        self._extension_map: dict[str, BaseLoader] = {}
        self._mime_map: dict[str, BaseLoader] = {}

    def register(
        self,
        extensions: list[str],
        loader: BaseLoader,
        mime_types: list[str] | None = None,
    ):
        for ext in extensions:
            clean_ext = ext.lower() if ext.startswith(".") else f".{ext.lower()}"
            self._extension_map[clean_ext] = loader

        if mime_types:
            for mime in mime_types:
                self._mime_map[mime.lower()] = loader

    def get_loader(self, path: Path | str, mime_type: str | None = None) -> BaseLoader:
        p = Path(path)
        ext = p.suffix.lower()

        if ext in self._extension_map:
            return self._extension_map[ext]

        if mime_type and mime_type.lower() in self._mime_map:
            return self._mime_map[mime_type.lower()]

        raise ValueError(f"No loader registered for extension '{ext}' or mime type '{mime_type}'")

    def supported_extensions(self) -> list[str]:
        return sorted(list(self._extension_map.keys()))

