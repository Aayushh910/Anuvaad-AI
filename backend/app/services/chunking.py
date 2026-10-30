import json
import os
from pathlib import Path

from langchain_text_splitters import RecursiveCharacterTextSplitter
from app.services.loaders.base import Segment

BASE_DIR = Path(__file__).resolve().parents[2]
PROCESSED_DIR = BASE_DIR / "storage" / "processed"
CHUNKS_DIR = BASE_DIR / "storage" / "chunks"

CHUNKS_DIR.mkdir(parents=True, exist_ok=True)


def get_text_splitter() -> RecursiveCharacterTextSplitter:
    """Create a text splitter with configurable chunk size and overlap."""
    chunk_size = int(os.getenv("CHUNK_SIZE", "800"))
    chunk_overlap = int(os.getenv("CHUNK_OVERLAP", "120"))
    return RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n## ", "\n### ", "\n\n", "\n", " ", ""],
        add_start_index=True,
    )


def chunk_segments(
    segments: list[Segment],
    document_id: str,
    filename: str,
) -> list[dict]:
    """
    Chunk extracted Segments into uniform chunks preserving metadata:
    document_id (file hash), filename, page_or_slide_or_sheet, and content_type.
    """
    splitter = get_text_splitter()
    records: list[dict] = []

    for seg in segments:
        text = seg.text.strip()
        if not text:
            continue

        split_docs = splitter.create_documents(
            texts=[text],
            metadatas=[
                {
                    "document_id": document_id,
                    "filename": filename,
                    "page_or_slide_or_sheet": seg.page_or_slide_or_sheet,
                    "page_number": seg.page_or_slide_or_sheet if isinstance(seg.page_or_slide_or_sheet, int) else None,
                    "content_type": seg.content_type,
                    **seg.metadata,
                }
            ],
        )

        for chunk in split_docs:
            records.append(
                {
                    "chunk_id": f"{document_id}_{len(records)}",
                    "document_id": document_id,
                    "chunk_index": len(records),
                    "text": chunk.page_content,
                    "metadata": {
                        **chunk.metadata,
                        "start_index": chunk.metadata.get("start_index", 0),
                    },
                }
            )

    output_path = CHUNKS_DIR / f"{document_id}.json"
    output_path.write_text(
        json.dumps(records, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return records


def chunk_document(document_id: str) -> dict:
    """Legacy compatibility chunking function for processed documents."""
    markdown_path = PROCESSED_DIR / f"{document_id}.md"
    metadata_path = PROCESSED_DIR / f"{document_id}.json"
    pages_path = PROCESSED_DIR / f"{document_id}.pages.json"

    if not metadata_path.exists():
        raise FileNotFoundError(f"Processed document not found: {document_id}")

    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    original_filename = metadata.get("original_filename", f"{document_id}.pdf")

    # If pages_path exists, use it as segments
    segments = []
    if pages_path.exists():
        pages = json.loads(pages_path.read_text(encoding="utf-8"))
        for p in pages:
            segments.append(
                Segment(
                    text=p.get("text", ""),
                    source=original_filename,
                    page_or_slide_or_sheet=p.get("page_number", 1),
                    content_type="text",
                )
            )
    elif markdown_path.exists():
        segments.append(
            Segment(
                text=markdown_path.read_text(encoding="utf-8"),
                source=original_filename,
                page_or_slide_or_sheet=1,
                content_type="text",
            )
        )

    records = chunk_segments(segments, document_id, original_filename)
    chunk_size = int(os.getenv("CHUNK_SIZE", "800"))
    chunk_overlap = int(os.getenv("CHUNK_OVERLAP", "120"))

    return {
        "document_id": document_id,
        "chunk_count": len(records),
        "chunk_file": f"{document_id}.json",
        "chunk_size": chunk_size,
        "chunk_overlap": chunk_overlap,
        "page_aware": True,
    }
