import os
import json
import shutil
import re
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
from docling.document_converter import DocumentConverter
from fastapi import FastAPI, File, HTTPException, UploadFile, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from app.services.answering import generate_answer
from app.services.chunking import chunk_document
from app.services.vector_store import (
    index_document_with_tables,
    delete_document_vectors,
)
from app.services.table_extraction import extract_tables
from app.services.image_extraction import extract_pdf_images
from app.services.vision import describe_image


from app.core.config import settings


app = FastAPI(
    title=settings.app_name,
    description="Multimodal PDF RAG Assistant API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path(__file__).resolve().parents[1] / "storage" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB


PROCESSED_DIR = (
    Path(__file__).resolve().parents[1]
    / "storage"
    / "processed"
)
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

IMAGE_ROOT = PROCESSED_DIR / "images"
IMAGE_ROOT.mkdir(parents=True, exist_ok=True)

CHUNKS_DIR = Path(__file__).resolve().parents[1] / "storage" / "chunks"
CHUNKS_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/")
def root():
    return {
        "message": "Multimodal PDF RAG Assistant API",
        "status": "running",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "app": settings.app_name,
    }


@app.get(f"{settings.api_v1_prefix}/health")
def api_health_check():
    return {
        "status": "healthy",
        "api_version": "v1",
    }


@app.get("/api/v1/documents", tags=["Documents"])
def list_documents():
    docs = []
    for meta_file in PROCESSED_DIR.glob("*.json"):
        if (
            meta_file.name.endswith(".images.json")
            or meta_file.name.endswith(".tables.json")
            or meta_file.name.endswith(".pages.json")
        ):
            continue
        try:
            data = json.loads(meta_file.read_text(encoding="utf-8"))
            doc_id = data.get("document_id")
            if doc_id:
                chunks_file = CHUNKS_DIR / f"{doc_id}.json"
                data["is_indexed"] = chunks_file.exists()
                if chunks_file.exists() and "chunk_count" not in data:
                    try:
                        chunks_data = json.loads(chunks_file.read_text(encoding="utf-8"))
                        data["chunk_count"] = len(chunks_data)
                    except Exception:
                        pass
            docs.append(data)
        except Exception:
            continue
    # Sort by processed_at descending if available
    docs.sort(key=lambda d: d.get("processed_at", ""), reverse=True)
    return docs


def background_describe_images(document_id: str, images_metadata_path: Path):
    """Generate image descriptions asynchronously in the background."""
    try:
        if not images_metadata_path.exists():
            return
        records = json.loads(images_metadata_path.read_text(encoding="utf-8"))
        changed = False
        for record in records:
            if not record.get("description") and record.get("image_path"):
                try:
                    record["description"] = describe_image(
                        image_path=record["image_path"],
                        page_number=record.get("page_number", 1),
                    )
                    changed = True
                except Exception:
                    pass
        if changed:
            images_metadata_path.write_text(
                json.dumps(records, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
    except Exception as exc:
        print(f"Background image description failed for {document_id}: {exc}")


@app.post("/api/v1/documents/upload", tags=["Documents"])
def upload_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    if not file.filename or Path(file.filename).suffix.lower() != ".pdf":
        raise HTTPException(
            status_code=400,
            detail="Please upload a PDF file.",
        )

    saved_path = UPLOAD_DIR / f"{uuid4().hex}.pdf"
    total_size = 0

    try:
        # Stream to disk and enforce the size limit.
        with saved_path.open("wb") as destination:
            while True:
                chunk = file.file.read(1024 * 1024)

                if not chunk:
                    break

                total_size += len(chunk)

                if total_size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail="PDF exceeds the 25 MB limit.",
                    )

                destination.write(chunk)

        if total_size == 0:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is empty.",
            )

        # Fast layout, markdown, tables, and image extraction (without blocking on vision API)
        proc_result = process_pdf_document(
            saved_path,
            file.filename,
            total_size,
            generate_descriptions_sync=False,
        )

        # Enrich image descriptions in the background if enabled
        if (
            os.getenv("DOCDUMIND_GENERATE_IMAGE_DESCRIPTIONS", "false").lower()
            == "true"
        ):
            images_meta_path = PROCESSED_DIR / f"{saved_path.stem}.images.json"
            background_tasks.add_task(
                background_describe_images,
                saved_path.stem,
                images_meta_path,
            )

        # Auto-chunk and index document into Qdrant immediately so it is 100% ready for queries
        try:
            chunk_result = chunk_document(saved_path.stem)
            index_result = index_document_with_tables(saved_path.stem)
            chunk_count = chunk_result["chunk_count"]
            indexed_chunks = index_result["indexed_chunks"]
            indexed_tables = index_result["indexed_tables"]
        except Exception as exc:
            print(f"Warning: Auto-indexing during upload failed: {exc}")
            chunk_count = 0
            indexed_chunks = 0
            indexed_tables = 0

        return {
            "status": "success",
            "document_id": saved_path.stem,
            "filename": file.filename,
            "size_bytes": total_size,
            "page_count": proc_result["page_count"],
            "character_count": proc_result["character_count"],
            "image_count": proc_result["image_count"],
            "chunk_count": chunk_count,
            "indexed_chunks": indexed_chunks,
            "indexed_tables": indexed_tables,
            "images_metadata_file": proc_result["images_metadata_file"],
            "table_count": proc_result["table_count"],
            "tables_metadata_file": proc_result["tables_metadata_file"],
            "markdown_file": proc_result["markdown_file"],
            "metadata_file": f"{saved_path.stem}.json",
            "content_preview": proc_result["content_preview"],
            "preview_truncated": proc_result["preview_truncated"],
            "message": "PDF uploaded, processed, and indexed successfully.",
        }

    except HTTPException:
        saved_path.unlink(missing_ok=True)
        raise

    except Exception as exc:
        saved_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=500,
            detail=f"PDF processing failed: {type(exc).__name__}: {exc}",
        ) from exc

    finally:
        file.file.close()


def process_pdf_document(
    saved_path: Path,
    filename: str,
    total_size: int,
    generate_descriptions_sync: bool = False,
) -> dict:
    """Convert PDF with Docling, extract images, tables, pages, and save metadata."""
    converter = DocumentConverter()
    result = converter.convert(str(saved_path))

    markdown = result.document.export_to_markdown()
    page_count = len(result.document.pages)

    # Extract embedded images and preserve document/page metadata.
    image_output_dir = IMAGE_ROOT / saved_path.stem

    extracted_images = extract_pdf_images(
        pdf_path=str(saved_path),
        output_dir=str(image_output_dir),
        generate_descriptions=generate_descriptions_sync,
    )

    images_metadata_path = (
        PROCESSED_DIR / f"{saved_path.stem}.images.json"
    )

    images_metadata_path.write_text(
        json.dumps(
            extracted_images,
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    # Extract text with actual page numbers from Docling.
    page_texts = {}

    for item, _ in result.document.iterate_items():
        text = getattr(item, "text", None)

        if not text or not text.strip():
            continue

        provenance = getattr(item, "prov", None) or []

        for source in provenance:
            page_number = source.page_no

            if page_number not in page_texts:
                page_texts[page_number] = []

            page_texts[page_number].append(text.strip())

    pages_data = [
        {
            "page_number": page_number,
            "text": "\n".join(texts),
        }
        for page_number, texts in sorted(page_texts.items())
    ]

    # Extract structured tables from the uploaded PDF.
    extracted_tables = extract_tables(str(saved_path))

    tables_metadata_path = (
        PROCESSED_DIR / f"{saved_path.stem}.tables.json"
    )

    tables_metadata_path.write_text(
        json.dumps(
            extracted_tables,
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    # Save the complete extracted Markdown
    markdown_path = PROCESSED_DIR / f"{saved_path.stem}.md"
    markdown_path.write_text(markdown, encoding="utf-8")

    pages_path = PROCESSED_DIR / f"{saved_path.stem}.pages.json"
    pages_path.write_text(
        json.dumps(pages_data, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    # Save document metadata
    metadata = {
        "document_id": saved_path.stem,
        "original_filename": filename,
        "size_bytes": total_size,
        "page_count": page_count,
        "character_count": len(markdown),
        "image_count": len(extracted_images),
        "images_metadata_file": images_metadata_path.name,
        "table_count": len(extracted_tables),
        "tables_metadata_file": tables_metadata_path.name,
        "markdown_file": markdown_path.name,
        "processed_at": datetime.now(timezone.utc).isoformat(),
    }

    metadata_path = PROCESSED_DIR / f"{saved_path.stem}.json"
    metadata_path.write_text(
        json.dumps(metadata, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    return {
        **metadata,
        "content_preview": markdown[:10000],
        "preview_truncated": len(markdown) > 10000,
    }


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    document_id: str | None = None
    limit: int = Field(default=5, ge=1, le=10)


@app.post("/api/v1/documents/{document_id}/reindex", tags=["Documents"])
@app.post("/api/v1/documents/{document_id}/index", tags=["Documents"])
def reindex_pdf_document(
    document_id: str,
    full_reprocess: bool = Query(
        default=False,
        description="Whether to re-extract text, images, and tables from the source PDF before chunking and embedding",
    ),
):
    if not document_id or not re.match(r"^[a-zA-Z0-9_-]+$", document_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid document ID format.",
        )

    pages_path = PROCESSED_DIR / f"{document_id}.pages.json"
    saved_pdf = UPLOAD_DIR / f"{document_id}.pdf"
    metadata_path = PROCESSED_DIR / f"{document_id}.json"

    # If full reprocess is requested or pages.json is missing, attempt re-extracting from source PDF
    if full_reprocess or not pages_path.exists():
        if not saved_pdf.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Cannot reprocess document '{document_id}': source PDF not found in storage.",
            )
        try:
            filename = f"{document_id}.pdf"
            if metadata_path.exists():
                try:
                    existing_meta = json.loads(
                        metadata_path.read_text(encoding="utf-8")
                    )
                    filename = existing_meta.get("original_filename", filename)
                except Exception:
                    pass
            total_size = saved_pdf.stat().st_size
            process_pdf_document(saved_pdf, filename, total_size)
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Document reprocessing failed: {type(exc).__name__}: {exc}",
            ) from exc

    try:
        # Step 1: Create page-aware text chunks.
        chunk_result = chunk_document(document_id)

        # Step 2: Index text chunks and extracted tables into Qdrant.
        index_result = index_document_with_tables(document_id)

        # Update metadata timestamp and stats
        if metadata_path.exists():
            try:
                meta = json.loads(metadata_path.read_text(encoding="utf-8"))
                meta["processed_at"] = datetime.now(timezone.utc).isoformat()
                meta["chunk_count"] = chunk_result["chunk_count"]
                meta["indexed_chunks"] = index_result["indexed_chunks"]
                meta["indexed_tables"] = index_result["indexed_tables"]
                metadata_path.write_text(
                    json.dumps(meta, indent=2, ensure_ascii=False),
                    encoding="utf-8",
                )
            except Exception:
                pass

        return {
            "status": "success",
            "document_id": document_id,
            "chunk_count": chunk_result["chunk_count"],
            "indexed_chunks": index_result["indexed_chunks"],
            "indexed_tables": index_result["indexed_tables"],
            "collection": index_result["collection"],
            "reprocessed": full_reprocess or not pages_path.exists(),
            "message": "Document reindexed successfully.",
        }

    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Document reindexing failed: {type(exc).__name__}: {exc}",
        ) from exc


@app.delete("/api/v1/documents/{document_id}", tags=["Documents"])
def delete_document(document_id: str):
    """Delete a document, all associated processed files, and its vector embeddings."""
    if not document_id or not re.match(r"^[a-zA-Z0-9_-]+$", document_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid document ID format.",
        )

    metadata_file = PROCESSED_DIR / f"{document_id}.json"
    upload_file = UPLOAD_DIR / f"{document_id}.pdf"
    chunks_file = CHUNKS_DIR / f"{document_id}.json"

    # Check if the document exists in storage
    has_processed_files = list(PROCESSED_DIR.glob(f"{document_id}*"))
    if not metadata_file.exists() and not upload_file.exists() and not has_processed_files:
        raise HTTPException(
            status_code=404,
            detail=f"Document with ID '{document_id}' not found.",
        )

    # 1. Delete vectors from Qdrant
    try:
        delete_document_vectors(document_id)
    except Exception as exc:
        # Do not fail document deletion if Qdrant removal logs warning
        print(f"Warning: Failed to delete vector embeddings for {document_id}: {exc}")

    # 2. Delete uploaded PDF
    upload_file.unlink(missing_ok=True)

    # 3. Delete chunk file
    chunks_file.unlink(missing_ok=True)

    # 4. Delete extracted images folder
    image_dir = IMAGE_ROOT / document_id
    if image_dir.exists() and image_dir.is_dir():
        shutil.rmtree(image_dir, ignore_errors=True)

    # 5. Delete all matching processed files
    for f in PROCESSED_DIR.glob(f"{document_id}*"):
        try:
            if f.is_file():
                f.unlink(missing_ok=True)
            elif f.is_dir():
                shutil.rmtree(f, ignore_errors=True)
        except Exception:
            pass

    return {
        "status": "success",
        "document_id": document_id,
        "message": f"Document '{document_id}' and all associated indexed data deleted successfully.",
    }

@app.post("/ask")
def ask_document(request: AskRequest):
    try:
        return generate_answer(
            question=request.question,
            document_id=request.document_id,
            limit=request.limit,
        )
    except ValueError as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=str(exc))