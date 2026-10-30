import tempfile
from pathlib import Path
import pytest

from app.services.loaders import (
    registry,
    compute_file_hash,
    Segment,
    TextLoader,
    SpreadsheetLoader,
    PdfLoader,
)


def test_registry_resolution():
    """Verify registry resolves appropriate loader classes for each registered extension."""
    assert isinstance(registry.get_loader("sample.pdf"), PdfLoader)
    assert isinstance(registry.get_loader("notes.txt"), TextLoader)
    assert isinstance(registry.get_loader("document.md"), TextLoader)
    assert isinstance(registry.get_loader("data.csv"), SpreadsheetLoader)
    assert isinstance(registry.get_loader("data.xlsx"), SpreadsheetLoader)

    with pytest.raises(ValueError):
        registry.get_loader("unknown.xyz123")


def test_text_loader():
    """Test TextLoader on plain text and markdown files."""
    loader = TextLoader()
    with tempfile.NamedTemporaryFile("w+", suffix=".txt", delete=False, encoding="utf-8") as f:
        f.write("Line 1: Contract conditions.\nLine 2: Terms of service.")
        f_path = Path(f.name)

    try:
        segments = loader.load(f_path)
        assert len(segments) == 1
        seg = segments[0]
        assert isinstance(seg, Segment)
        assert "Contract conditions" in seg.text
        assert seg.content_type == "text"
        assert seg.page_or_slide_or_sheet == 1
    finally:
        f_path.unlink(missing_ok=True)


def test_csv_loader_header_preservation():
    """Test SpreadsheetLoader preserves column headers with rows for tabular context."""
    loader = SpreadsheetLoader()
    with tempfile.NamedTemporaryFile("w+", suffix=".csv", delete=False, encoding="utf-8") as f:
        f.write("Name,Role,Department\nAlice,Architect,Engineering\nBob,Lead,Security")
        f_path = Path(f.name)

    try:
        segments = loader.load(f_path)
        assert len(segments) == 1
        seg = segments[0]
        assert seg.content_type == "table"
        assert "Name: Alice" in seg.text
        assert "Role: Architect" in seg.text
        assert "Department: Engineering" in seg.text
        assert "Name: Bob" in seg.text
    finally:
        f_path.unlink(missing_ok=True)


def test_file_hash_determinism():
    """Verify compute_file_hash generates deterministic, non-empty SHA-256 strings."""
    with tempfile.NamedTemporaryFile("wb", suffix=".bin", delete=False) as f:
        f.write(b"Test content for hashing")
        f_path = Path(f.name)

    try:
        hash1 = compute_file_hash(f_path)
        hash2 = compute_file_hash(f_path)
        assert hash1 == hash2
        assert len(hash1) == 64
    finally:
        f_path.unlink(missing_ok=True)

