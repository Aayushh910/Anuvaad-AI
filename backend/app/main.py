import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
from docling.document_converter import DocumentConverter
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from app.services.answering import generate_answer
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