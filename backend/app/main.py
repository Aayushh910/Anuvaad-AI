import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
from docling.document_converter import DocumentConverter
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

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

        # Save the complete extracted Markdown
        markdown_path = PROCESSED_DIR / f"{saved_path.stem}.md"
        markdown_path.write_text(markdown, encoding="utf-8")

        # Save document metadata
        metadata = {
            "document_id": saved_path.stem,
            "original_filename": file.filename,
            "size_bytes": total_size,
            "page_count": page_count,
            "character_count": len(markdown),
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
