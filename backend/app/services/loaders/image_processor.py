import base64
import io
import json
import logging
import os
from pathlib import Path
from typing import Any

from PIL import Image, ImageOps, ImageStat

logger = logging.getLogger(__name__)

GENERIC_VISION_PROMPT = (
    "Transcribe all visible text exactly, preserving numbers, symbols, labels and table structure. "
    "Then describe what the image shows (type of screen/chart/diagram/scan) in 1-2 sentences. "
    "Do not invent anything not visible."
)


class UnifiedImageProcessor:
    """
    Unified image understanding layer used across all loaders.
    Provides Vision LLM transcription, OCR fallback with image preprocessing,
    and persistent disk caching keyed by file hash + index.
    """

    def __init__(self, cache_dir: Path | str | None = None):
        if cache_dir is None:
            cache_dir = Path(__file__).resolve().parents[3] / "storage" / "cache"
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.cache_file = self.cache_dir / "vision_cache.json"
        self._cache: dict[str, str] = self._load_cache()

    def _load_cache(self) -> dict[str, str]:
        if self.cache_file.exists():
            try:
                return json.loads(self.cache_file.read_text(encoding="utf-8"))
            except Exception as e:
                logger.warning("Failed to load vision cache from %s: %s", self.cache_file, e)
        return {}

    def _save_cache(self):
        try:
            self.cache_file.write_text(
                json.dumps(self._cache, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
        except Exception as e:
            logger.warning("Failed to save vision cache to %s: %s", self.cache_file, e)

    def process_image(
        self,
        image_bytes: bytes,
        file_hash: str,
        index_or_page: int | str,
        ext: str = "png",
    ) -> str:
        """Process image with Vision LLM or OCR fallback, utilizing persistent caching."""
        cache_key = f"{file_hash}_{index_or_page}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        provider = os.getenv("VISION_PROVIDER", "groq").lower().strip()
        result = ""

        # 1. Primary: Vision-capable LLM
        if provider == "groq":
            try:
                result = self._call_vision_llm(image_bytes, ext=ext)
            except Exception as e:
                logger.warning(
                    "Vision LLM failed for %s_%s: %s. Falling back to OCR.",
                    file_hash[:8],
                    index_or_page,
                    e,
                )
                result = ""

        # 2. Fallback: OCR with image preprocessing
        if not result.strip():
            ocr_enabled = os.getenv("OCR_ENABLED", "true").lower() in ("true", "1", "yes")
            if ocr_enabled:
                try:
                    result = self._run_ocr_fallback(image_bytes)
                except Exception as e:
                    logger.warning(
                        "OCR fallback failed for %s_%s: %s",
                        file_hash[:8],
                        index_or_page,
                        e,
                    )
                    result = ""

        clean_result = result.strip()
        if clean_result:
            self._cache[cache_key] = clean_result
            self._save_cache()

        return clean_result

    def _call_vision_llm(self, image_bytes: bytes, ext: str = "png") -> str:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY not configured for vision provider.")

        from groq import Groq

        model_name = os.getenv("GROQ_VISION_MODEL", "qwen/qwen3.6-27b")
        mime = f"image/{ext.lower().replace('.', '')}"
        if mime == "image/jpg":
            mime = "image/jpeg"

        b64 = base64.b64encode(image_bytes).decode("utf-8")
        image_url = f"data:{mime};base64,{b64}"

        client = Groq(api_key=api_key)
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": GENERIC_VISION_PROMPT},
                        {"type": "image_url", "image_url": {"url": image_url}},
                    ],
                }
            ],
            temperature=0,
            max_completion_tokens=1024,
        )

        content = response.choices[0].message.content
        return content if isinstance(content, str) else str(content or "")

    def _run_ocr_fallback(self, image_bytes: bytes) -> str:
        """Preprocessing pipeline: Grayscale, 2x upscale, auto-invert dark backgrounds, then OCR."""
        try:
            import pytesseract
        except ImportError:
            logger.warning("pytesseract is not installed; skipping OCR fallback.")
            return ""

        try:
            image = Image.open(io.BytesIO(image_bytes))

            # 1. Grayscale
            gray = image.convert("L")

            # 2. Check background luminance for auto-inversion
            stat = ImageStat.Stat(gray)
            avg_luminance = stat.mean[0] if stat.mean else 255
            if avg_luminance < 128:  # Dark background, invert for OCR accuracy
                gray = ImageOps.invert(gray)

            # 3. 2x upscale with high-quality resampling
            w, h = gray.size
            upscaled = gray.resize((w * 2, h * 2), Image.Resampling.LANCZOS)

            # 4. Tesseract OCR
            text = pytesseract.image_to_string(upscaled, lang=os.getenv("OCR_LANG", "eng"))
            if text.strip():
                return f"[OCR Transcription]:\n{text.strip()}"
            return ""
        except Exception as e:
            logger.warning("Tesseract execution encountered an error: %s", e)
            return ""


# Singleton instance
image_processor = UnifiedImageProcessor()

