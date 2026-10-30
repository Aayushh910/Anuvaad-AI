import os
import json
import shutil
import re
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, UploadFile, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.services.answering import generate_answer
from app.services.chunking import chunk_segments, chunk_document
from app.services.loaders import registry, compute_file_hash
from app.services.vector_store import (
    index_document,
    index_document_with_tables,
    delete_document_vectors,
)
from app.core.config import settings


app = FastAPI(
    title=settings.app_name,
    description="Multimodal Document RAG Assistant API",
    version="0.2.0",
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

PROCESSED_DIR = Path(__file__).resolve().parents[1] / "storage" / "processed"
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

IMAGE_ROOT = PROCESSED_DIR / "images"
IMAGE_ROOT.mkdir(parents=True, exist_ok=True)

CHUNKS_DIR = Path(__file__).resolve().parents[1] / "storage" / "chunks"
CHUNKS_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/")
def root():
    return {
        "message": "Multimodal Document RAG Assistant API",
        "status": "running",
        "supported_formats": registry.supported_extensions(),
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
    docs.sort(key=lambda d: d.get("processed_at", ""), reverse=True)
    return docs


@app.post("/api/v1/documents/upload", tags=["Documents"])
def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Filename is missing.",
        )

    ext = Path(file.filename).suffix.lower()
    if ext not in registry.supported_extensions():
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{ext}'. Supported: {', '.join(registry.supported_extensions())}",
        )

    temp_id = uuid4().hex
    saved_path = UPLOAD_DIR / f"{temp_id}{ext}"
    total_size = 0

    try:
        # Stream file to disk and check file size limit
        with saved_path.open("wb") as destination:
            while True:
                chunk = file.file.read(1024 * 1024)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail="File exceeds the 25 MB limit.",
                    )
                destination.write(chunk)

        if total_size == 0:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is empty.",
            )

        # Compute deterministic document ID based on file hash
        file_hash = compute_file_hash(saved_path)
        final_doc_id = file_hash[:16]
        final_path = UPLOAD_DIR / f"{final_doc_id}{ext}"

        if saved_path != final_path:
            saved_path.replace(final_path)
            saved_path = final_path

        # Pluggable loader extraction
        loader = registry.get_loader(saved_path, mime_type=file.content_type)
        segments = loader.load(saved_path)

        if not segments:
            raise ValueError(f"No extractable text or visual content found in '{file.filename}'.")

        # Create uniform chunks
        chunks = chunk_segments(
            segments=segments,
            document_id=final_doc_id,
            filename=file.filename,
        )

        # Index into vector database
        index_result = index_document(final_doc_id)

        # Build preview markdown
        combined_markdown = "\n\n---\n\n".join(seg.text for seg in segments)
        markdown_path = PROCESSED_DIR / f"{final_doc_id}.md"
        markdown_path.write_text(combined_markdown, encoding="utf-8")

        # Compatibility pages metadata
        pages_data = [
            {
                "page_number": seg.page_or_slide_or_sheet,
                "content_type": seg.content_type,
                "text": seg.text,
            }
            for seg in segments
        ]
        pages_path = PROCESSED_DIR / f"{final_doc_id}.pages.json"
        pages_path.write_text(
            json.dumps(pages_data, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

        # Save document metadata
        metadata = {
            "document_id": final_doc_id,
            "file_hash": file_hash,
            "original_filename": file.filename,
            "extension": ext,
            "size_bytes": total_size,
            "page_count": len(segments),
            "character_count": len(combined_markdown),
            "image_count": sum(1 for s in segments if s.metadata.get("has_visual_content")),
            "chunk_count": len(chunks),
            "indexed_chunks": index_result.get("indexed_chunks", len(chunks)),
            "indexed_tables": 0,
            "markdown_file": markdown_path.name,
            "processed_at": datetime.now(timezone.utc).isoformat(),
        }

        meta_path = PROCESSED_DIR / f"{final_doc_id}.json"
        meta_path.write_text(
            json.dumps(metadata, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

        return {
            "status": "success",
            "document_id": final_doc_id,
            "filename": file.filename,
            "size_bytes": total_size,
            "page_count": len(segments),
            "character_count": len(combined_markdown),
            "image_count": metadata["image_count"],
            "chunk_count": len(chunks),
            "indexed_chunks": metadata["indexed_chunks"],
            "indexed_tables": 0,
            "markdown_file": markdown_path.name,
            "metadata_file": meta_path.name,
            "content_preview": combined_markdown[:10000],
            "preview_truncated": len(combined_markdown) > 10000,
            "message": "Document uploaded, processed, and indexed successfully.",
        }

    except HTTPException:
        saved_path.unlink(missing_ok=True)
        raise

    except Exception as exc:
        saved_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=500,
            detail=f"Document processing failed: {type(exc).__name__}: {exc}",
        ) from exc

    finally:
        file.file.close()


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    document_id: str | None = None
    limit: int | None = Field(default=None, ge=1, le=20)


@app.post("/api/v1/documents/{document_id}/reindex", tags=["Documents"])
@app.post("/api/v1/documents/{document_id}/index", tags=["Documents"])
def reindex_document(
    document_id: str,
    full_reprocess: bool = Query(
        default=False,
        description="Whether to reload and re-chunk the source document before embedding",
    ),
):
    if not document_id or not re.match(r"^[a-zA-Z0-9_-]+$", document_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid document ID format.",
        )

    # Locate source file in storage
    matching_uploads = list(UPLOAD_DIR.glob(f"{document_id}.*"))
    saved_file = matching_uploads[0] if matching_uploads else None
    metadata_path = PROCESSED_DIR / f"{document_id}.json"

    if full_reprocess or not (CHUNKS_DIR / f"{document_id}.json").exists():
        if not saved_file or not saved_file.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Source file for '{document_id}' not found in storage.",
            )

        filename = saved_file.name
        if metadata_path.exists():
            try:
                meta = json.loads(metadata_path.read_text(encoding="utf-8"))
                filename = meta.get("original_filename", filename)
            except Exception:
                pass

        loader = registry.get_loader(saved_file)
        segments = loader.load(saved_file)
        chunks = chunk_segments(segments, document_id=document_id, filename=filename)
    else:
        chunks_file = CHUNKS_DIR / f"{document_id}.json"
        chunks = json.loads(chunks_file.read_text(encoding="utf-8"))

    index_result = index_document(document_id)

    if metadata_path.exists():
        try:
            meta = json.loads(metadata_path.read_text(encoding="utf-8"))
            meta["processed_at"] = datetime.now(timezone.utc).isoformat()
            meta["chunk_count"] = len(chunks)
            meta["indexed_chunks"] = index_result["indexed_chunks"]
            metadata_path.write_text(
                json.dumps(meta, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
        except Exception:
            pass

    return {
        "status": "success",
        "document_id": document_id,
        "chunk_count": len(chunks),
        "indexed_chunks": index_result["indexed_chunks"],
        "collection": index_result["collection"],
        "reprocessed": full_reprocess,
        "message": "Document reindexed successfully.",
    }


@app.delete("/api/v1/documents/{document_id}", tags=["Documents"])
def delete_document(document_id: str):
    """Delete a document, all associated processed files, and its vector embeddings."""
    if not document_id or not re.match(r"^[a-zA-Z0-9_-]+$", document_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid document ID format.",
        )

    # 1. Delete vectors from Qdrant
    try:
        delete_document_vectors(document_id)
    except Exception as exc:
        print(f"Warning: Failed to delete vector embeddings for {document_id}: {exc}")

    # 2. Delete uploaded source files
    for f in UPLOAD_DIR.glob(f"{document_id}.*"):
        f.unlink(missing_ok=True)

    # 3. Delete chunk file
    (CHUNKS_DIR / f"{document_id}.json").unlink(missing_ok=True)

    # 4. Delete extracted images folder if any
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
        raise HTTPException(status_code=400, detail=str(exc))
