import json
from pathlib import Path

from langchain_text_splitters import RecursiveCharacterTextSplitter

BASE_DIR = Path(__file__).resolve().parents[2]
PROCESSED_DIR = BASE_DIR / "storage" / "processed"
CHUNKS_DIR = BASE_DIR / "storage" / "chunks"

CHUNKS_DIR.mkdir(parents=True, exist_ok=True)

splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=120,
    separators=["\n## ", "\n### ", "\n\n", "\n", " ", ""],
    add_start_index=True,
)


def chunk_document(document_id: str) -> dict:
    markdown_path = PROCESSED_DIR / f"{document_id}.md"
    metadata_path = PROCESSED_DIR / f"{document_id}.json"

    if not markdown_path.exists() or not metadata_path.exists():
        raise FileNotFoundError(
            f"Processed document not found: {document_id}"
        )

    markdown = markdown_path.read_text(encoding="utf-8")
    metadata = json.loads(
        metadata_path.read_text(encoding="utf-8")
    )

    # Load the page-aware text extracted from Docling.
    pages_path = PROCESSED_DIR / f"{document_id}.pages.json"

    if not pages_path.exists():
        raise FileNotFoundError(
            f"Page-aware extraction not found: {pages_path.name}. "
            "Reprocess the PDF before chunking."
        )

    pages = json.loads(pages_path.read_text(encoding="utf-8"))
    records = []

    for page in pages:
        page_number = page["page_number"]
        page_text = page["text"].strip()

        if not page_text:
            continue

        chunks = splitter.create_documents(
            texts=[page_text],
            metadatas=[
                {
                    "document_id": document_id,
                    "filename": metadata["original_filename"],
                    "source_file": markdown_path.name,
                    "page_number": page_number,
                }
            ],
        )

        for chunk in chunks:
            records.append(
                {
                    "chunk_id": f"{document_id}_{len(records)}",
                    "document_id": document_id,
                    "chunk_index": len(records),
                    "text": chunk.page_content,
                    "metadata": {
                        **chunk.metadata,
                        "start_index": chunk.metadata.get(
                            "start_index", 0
                        ),
                    },
                }
            )

    output_path = CHUNKS_DIR / f"{document_id}.json"
    output_path.write_text(
        json.dumps(records, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    return {
        "document_id": document_id,
        "chunk_count": len(records),
        "chunk_file": output_path.name,
        "chunk_size": 800,
        "chunk_overlap": 120,
        "page_aware": True,
    }