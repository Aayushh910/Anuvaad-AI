
import base64
from types import SimpleNamespace

import pytest

from app.services import vision


def test_analyze_image_calls_vision_model(tmp_path, monkeypatch):
    image_path = tmp_path / "chart.png"
    image_bytes = b"fake-png-content"
    image_path.write_bytes(image_bytes)

    captured = {}

    class FakeGroq:
        def __init__(self):
            self.chat = SimpleNamespace(
                completions=SimpleNamespace(create=self.create)
            )

        def create(self, **kwargs):
            captured.update(kwargs)
            return SimpleNamespace(
                choices=[
                    SimpleNamespace(
                        message=SimpleNamespace(
                            content="The chart shows an upward trend."
                        )
                    )
                ]
            )

    monkeypatch.setattr(vision, "Groq", FakeGroq)

    result = vision.analyze_image(
        str(image_path),
        "Describe the chart.",
        page_number=3,
    )

    assert result["answer"] == "The chart shows an upward trend."
    assert result["page"] == 3
    assert result["image_filename"] == "chart.png"
    assert captured["model"] == vision.VISION_MODEL

    image_part = captured["messages"][1]["content"][1]
    data_url = image_part["image_url"]["url"]

    assert data_url.startswith("data:image/png;base64,")
    encoded = data_url.split(",", 1)[1]
    assert base64.b64decode(encoded) == image_bytes


def test_analyze_image_rejects_empty_question(tmp_path):
    image_path = tmp_path / "chart.png"
    image_path.write_bytes(b"fake-image")

    with pytest.raises(ValueError, match="Question cannot be empty"):
        vision.analyze_image(str(image_path), "  ")


def test_analyze_image_rejects_unsupported_format(tmp_path):
    image_path = tmp_path / "chart.svg"
    image_path.write_text("<svg></svg>", encoding="utf-8")

    with pytest.raises(ValueError, match="Unsupported image format"):
        vision.analyze_image(str(image_path), "Describe it.")


def test_analyze_image_rejects_missing_file(tmp_path):
    with pytest.raises(FileNotFoundError):
        vision.analyze_image(str(tmp_path / "missing.png"), "Describe it.")
