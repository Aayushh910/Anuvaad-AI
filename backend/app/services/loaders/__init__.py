from app.services.loaders.base import BaseLoader, Segment, LoaderRegistry, compute_file_hash
from app.services.loaders.pdf_loader import PdfLoader
from app.services.loaders.office_loaders import DocxLoader, PptxLoader
from app.services.loaders.tabular_loaders import SpreadsheetLoader
from app.services.loaders.text_loaders import TextLoader
from app.services.loaders.image_loader import ImageLoader

registry = LoaderRegistry()

# Register PDF
registry.register([".pdf"], PdfLoader(), mime_types=["application/pdf"])

# Register Office formats
registry.register(
    [".docx"],
    DocxLoader(),
    mime_types=["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
)
registry.register(
    [".pptx"],
    PptxLoader(),
    mime_types=["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
)

# Register Spreadsheets & CSV
registry.register(
    [".xlsx", ".xls"],
    SpreadsheetLoader(),
    mime_types=[
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
    ],
)
registry.register([".csv"], SpreadsheetLoader(), mime_types=["text/csv"])

# Register Text, Markdown, HTML
registry.register(
    [".txt", ".md", ".html", ".htm"],
    TextLoader(),
    mime_types=["text/plain", "text/markdown", "text/html"],
)

# Register Standalone Images
registry.register(
    [".png", ".jpg", ".jpeg", ".webp"],
    ImageLoader(),
    mime_types=["image/png", "image/jpeg", "image/webp"],
)

__all__ = [
    "BaseLoader",
    "Segment",
    "LoaderRegistry",
    "compute_file_hash",
    "registry",
    "PdfLoader",
    "DocxLoader",
    "PptxLoader",
    "SpreadsheetLoader",
    "TextLoader",
    "ImageLoader",
]

