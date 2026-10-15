import os
import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
from docling.document_converter import DocumentConverter
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from app.services.answering import generate_answer
from app.services.chunking import chunk_document
from app.services.vector_store import index_document_with_tables
from app.services.table_extraction import extract_tables
from app.services.image_extraction import extract_pdf_images


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
    ],
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
            docs.append(data)
        except Exception:
            continue
    # Sort by processed_at descending if available
    docs.sort(key=lambda d: d.get("processed_at", ""), reverse=True)
    return docs


@app.post("/api/v1/documents/upload", tags=["Documents"])
def upload_pdf(file: UploadFile = File(...)):
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

        # Convert the PDF into structured document content.
        converter = DocumentConverter()
        result = converter.convert(str(saved_path))

        markdown = result.document.export_to_markdown()
        page_count = len(result.document.pages)

        # Extract embedded images and preserve document/page metadata.
        image_output_dir = IMAGE_ROOT / saved_path.stem

        extracted_images = extract_pdf_images(
            pdf_path=str(saved_path),
            output_dir=str(image_output_dir),
            generate_descriptions=(
                os.getenv("DOCDUMIND_GENERATE_IMAGE_DESCRIPTIONS", "false").lower()
                == "true"
            ),
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
            "original_filename": file.filename,
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
            "status": "success",
            "document_id": saved_path.stem,
            "filename": file.filename,
            "size_bytes": total_size,
            "page_count": page_count,
            "character_count": len(markdown),
            "image_count": len(extracted_images),
            "images_metadata_file": images_metadata_path.name,
            "table_count": len(extracted_tables),
            "tables_metadata_file": tables_metadata_path.name,
            "markdown_file": markdown_path.name,
            "metadata_file": metadata_path.name,
            "content_preview": markdown[:10000],
            "preview_truncated": len(markdown) > 10000,
            "message": "PDF processed successfully.",
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


class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    document_id: str | None = None
    limit: int = Field(default=5, ge=1, le=10)


@app.post("/api/v1/documents/{document_id}/index", tags=["Documents"])
def index_pdf_document(document_id: str):
    try:
        # Step 1: Create page-aware text chunks.
        chunk_result = chunk_document(document_id)

        # Step 2: Index text chunks and extracted tables.
        index_result = index_document_with_tables(document_id)

        return {
            "status": "success",
            "document_id": document_id,
            "chunk_count": chunk_result["chunk_count"],
            "indexed_chunks": index_result["indexed_chunks"],
            "indexed_tables": index_result["indexed_tables"],
            "collection": index_result["collection"],
            "message": "Document text and tables indexed successfully.",
        }

    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Document indexing failed: {type(exc).__name__}: {exc}",
        ) from exc

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